# 04 — E-commerce flow (priority area)

Findings: `ECM-01` … `ECM-13`.

---

## 1. The flow as built

```
                                 ┌───────────────────────────────────────┐
 Product                         │ product.status ∈ {draft,active,archived}
   listProducts / getProductBySlug   filter: status = 'active'   ✅
   │                             └───────────────────────────────────────┘
   ▼
 Catalog ── URL-synced filters/sort/search ── ProductCard ── ProductVariantPanel
   │
   ▼  addToCartAction  (no auth; guest cookie minted on demand)
 Cart      addCartItem: reads variant.stock, clamps qty, snapshots price
   │         ⚠ NO product.status check          → ECM-02
   │         ⚠ price snapshot may go stale      → handled at checkout
   ▼  checkoutAction  (rate-limited 10/min per client IP ⚠ SEC-04)
 Checkout  createOrder:
   │         · re-reads live stock + live price for every line   ✅
   │         · any mismatch → typed issue list, nothing written  ✅
   │         · ⚠ read and write are not in one transaction       → ECM-08
   │         · ⚠ NO product.status check                         → ECM-02
   │         · INSERT order(status=pending) + order_items         ✅ one tx
   │         · cart deliberately NOT cleared                      ✅
   │       createPayment(status=requires_payment)
   │       provider.createCheckoutSession → redirect
   │         ⚠ no idempotency: N clicks = N orders                → ECM-07
   ▼
 Payment   Stripe-hosted   |   /checkout/mock/[orderId]  ⚠ unauthenticated → SEC-01
   │
   ▼  webhook POST /api/webhooks/stripe   OR   approveMockPayment
 fulfillPaidOrder (one transaction):
   │  1. INSERT processed_webhook_event ON CONFLICT DO NOTHING → duplicate? no-op ✅
   │  2. for each item: UPDATE variant SET stock = stock - qty WHERE stock >= qty ✅
   │       └ on failure: collect variantId, CONTINUE the loop      ⚠ → ECM-01
   │  3. if any failed → payment=failed, RETURN (commits!)          ❌ ECM-01
   │  4. payment=succeeded  (unconditional)                         ⚠ ECM-04
   │  5. order=paid  WHERE status='pending'  (conditional)          ⚠ ECM-04
   │  6. DELETE cart_items WHERE cart_id = order.cart_id            ✅
   ▼  (outside tx, best-effort) sendOrderConfirmationEmail          ✅
 Order     /order/confirmation/[id] — unguessable id, no auth (by design)
   │         ⚠ 'refunded' renders "Thank you for your order!"       → ECM-10
   │         ⚠ 'cancelled' renders no status block at all           → ECM-10
   ▼
 Post-order  admin: paid → fulfilled ✅ · paid|fulfilled → refunded ✅
             ⚠ refund calls Stripe before validating state          → ECM-03
             ⚠ refund does not restore stock or log inventory       → ECM-05
             ⚠ pending → cancelled is never reachable               → ECM-06
```

---

## 2. Money and quantity consistency — traced end to end

I traced every value from product to order to confirm nothing is recomputed
from a different source at a later step.

| Value | Written at | Read from | Consistent? |
|---|---|---|---|
| unit price | `cart_item.price_snapshot_cents` at add-to-cart (`cart.ts:161`: `priceOverrideCents ?? basePriceCents`) | re-validated against live price at `orders.ts:87`, then copied to `order_item.unit_price_cents` (`orders.ts:129`) | ✅ |
| line total | `order_item.line_total_cents = unit_price × quantity` (`orders.ts:131`) | rendered from the snapshot | ✅ |
| subtotal | `Σ price_snapshot × quantity` (`orders.ts:99`) | `order.subtotal_cents` | ✅ |
| shipping | `getShippingMethod(id).cents` server-side (`checkout.ts:49`) — the client's displayed value is never trusted | `order.shipping_cents` | ✅ |
| total | `subtotal + shipping` (`orders.ts:100`) | `order.total_cents`; passed to the provider as `amountCents` | ✅ |
| tax | hardcoded `0` (`orders.ts:114`) | — | ⚠ BE-10 (spec'd out of scope) |
| product name / variant label | snapshotted at order creation (`orders.ts:127-128`) | never re-joined | ✅ |
| stock | decremented only in `fulfillPaidOrder` under a guarded UPDATE | — | ⚠ ECM-01, ECM-05 |
| currency | hardcoded `"USD"` at order creation despite `product.currency` existing | `order.currency` | ⚠ BE-10 |

**The core money path is correct.** The client cannot influence any amount:
`CheckoutForm` computes a display total but `checkoutAction` recomputes
everything from the DB and the server-side shipping table. There is no place
where a client-supplied price, quantity or total is trusted. This is the part
of the system most often got wrong, and it is right here.

The defects are all in the **failure edges**, not the arithmetic.

---

## ECM-01 `fulfillPaidOrder` commits a partial stock decrement on the oversold path

**Confidence: Confirmed**

### Localização

`packages/db/src/queries/orders.ts:311-369` — specifically the loop at
`320-343` and the early return at `345-351`.

```
Linha aproximada: 345
```

### Problema

```ts
return db.transaction(async (tx) => {
  // 1. idempotency insert …
  const items = await tx.select(…).from(orderItem).where(eq(orderItem.orderId, event.orderId));

  const unavailableVariantIds: string[] = [];
  for (const item of items) {
    const [decremented] = await tx.update(productVariant)
      .set({ stock: sql`${productVariant.stock} - ${item.quantity}` })
      .where(and(eq(productVariant.id, item.variantId), gte(productVariant.stock, item.quantity)))
      .returning({ id: productVariant.id });

    if (!decremented) {
      unavailableVariantIds.push(item.variantId);   // ← record and KEEP GOING
    } else {
      await tx.insert(inventoryLog).values({ … change: -item.quantity … });   // ← already written
    }
  }

  if (unavailableVariantIds.length > 0) {
    await tx.update(payment).set({ status: "failed", … });
    return { outcome: "oversold", unavailableVariantIds };   // ← RETURN, not throw
  }
  …
});
```

**Drizzle's `db.transaction()` commits when the callback returns and rolls back
only when it throws.** The `oversold` branch *returns*. Therefore everything
already done inside the transaction is **committed**:

- every line that decremented successfully **stays decremented**,
- every corresponding `inventory_log` row (reason `order`) **stays written**,
- `payment.status = 'failed'`,
- `order.status` stays `pending`.

For a **single-line order** this is harmless: the one line either succeeds
(→ `paid`) or fails (→ nothing decremented). That is exactly the case the
existing test covers (`orders.test.ts`, *"reports oversold and fails the
payment when a second order already consumed the last unit"* — a one-item
order) and the case the real-connection concurrency test covers
(`orders-concurrency.test.ts` — also one item). **The multi-line case is
untested and broken.**

For a **multi-line order**, if line 1 has stock and line 2 does not:

| | Before | After |
|---|---|---|
| variant A stock | 5 | **3** (decremented, never restored) |
| variant B stock | 0 | 0 |
| `inventory_log` | — | one row, `-2`, reason `order`, referencing this order |
| `payment.status` | `requires_payment` | `failed` |
| `order.status` | `pending` | `pending` |
| Money at Stripe | **captured** | **still captured — no refund is attempted** |

### Por que isso é um problema

Three compounding failures:

1. **Stock leaks permanently.** Two units of variant A are gone from
   inventory with no order that owns them. Nothing reconciles this. The
   inventory log actively lies — it records a sale that did not happen,
   pointing at an order that was never paid. Every subsequent oversold
   multi-line order leaks more. The low-stock dashboard and the catalog
   in-stock filter both drift from reality.
2. **The customer is charged and gets nothing.** `checkout.session.completed`
   means Stripe captured the payment. The handler marks the local payment
   `failed` and returns 200 — so Stripe never retries, the customer has a
   charge, and the store has an order stuck in `pending` with a `failed`
   payment. No refund is issued, no alert is raised. `logger.info` records
   `outcome: "oversold"` at **info** level, buried among normal traffic.
3. **The confirmation page tells the customer the wrong thing.** With
   `order.status = 'pending'` and `latestPaymentStatus = 'failed'`, the page
   renders *"Payment failed — Order X was not charged. Your cart is
   unchanged — you can try again."* (`order/confirmation/[id]/page.tsx:37-46`).
   **They were charged.** That message is materially false and invites a
   second purchase.

This also violates `architecture.md` §4, which specifies the decrement is
*"guarded: fails the transaction if stock would go negative"* — the
transaction is not failed.

### Cenário que reproduz o problema

Setup: variant A ("Iron Longsword / Standard") stock 5; variant B ("Wooden
Buckler / Standard") stock 1.

1. Customer 1 adds B ×1 → checkout → order O1 created (`pending`).
2. Customer 2 adds A ×2 **and** B ×1 → checkout → order O2 created (`pending`).
   Both pass validation: at creation time B still has stock 1.
3. Customer 1 pays. `fulfillPaidOrder(O1)` → B: 1 → 0. O1 is `paid`. ✅
4. Customer 2 pays. `fulfillPaidOrder(O2)`:
   - line A: `UPDATE … WHERE stock >= 2` succeeds → A: 5 → **3**, inventory
     log row written.
   - line B: `WHERE stock >= 1` matches nothing → pushed to
     `unavailableVariantIds`.
   - `payment.status = 'failed'`, `return { outcome: "oversold" }` → **commit**.
5. Final state: A is 3 (two units vanished), customer 2 is charged, order O2
   is `pending`, and `/order/confirmation/O2` says they were not charged.

This is not exotic — it is the ordinary "two people race for the last unit
while one of them also buys something else" case, which is the *stated* reason
the guarded decrement exists.

### Impacto

- Segurança: nenhum
- Correção: **crítico** (inventory corruption + a charge with no order)
- Performance: nenhum
- Manutenção: alto
- UX: **crítico** (customer charged, told they weren't)

### Severidade

**P0**

### Recomendação

Three changes, all required:

1. **Make the oversold path abort the transaction.** Restructure so the
   failure path throws a sentinel that the caller converts back into the typed
   outcome — the same shape `withTestTransaction` already uses for rollback:

   ```ts
   const OVERSOLD = Symbol("oversold");
   class OversoldError extends Error { constructor(readonly variantIds: string[]) { super("oversold"); } }

   export async function fulfillPaidOrder(db: DbClient, event: FulfillEvent): Promise<FulfillOutcome> {
     try {
       return await db.transaction(async (tx) => {
         …
         for (const item of items) {
           const [decremented] = await tx.update(productVariant)…;
           if (!decremented) throw new OversoldError([item.variantId]);   // aborts, rolls back
           await tx.insert(inventoryLog).values({…});
         }
         …
       });
     } catch (err) {
       if (err instanceof OversoldError) {
         // separate, committed transaction — the ledger entry must survive
         await recordOversoldFailure(db, event, err.variantIds);
         return { outcome: "oversold", unavailableVariantIds: err.variantIds };
       }
       throw err;
     }
   }
   ```

   **Critical subtlety:** the idempotency row (`processed_webhook_event`) is
   inserted *inside* the transaction. Rolling back removes it, so Stripe's
   retry would reprocess the event. That is arguably correct (stock might have
   been restocked by then) but it must be a deliberate choice. Recommended:
   in `recordOversoldFailure`, re-insert the `processed_webhook_event` row
   **and** set `payment.status = 'failed'` in one short committed
   transaction, so the event is not reprocessed and the failure is durable.
   Decide and document which you want; do not leave it implicit.

2. **Pre-check all lines before mutating any.** Cheaper and clearer than
   relying on rollback: `SELECT id, stock FROM product_variant WHERE id IN (…)
   FOR UPDATE` at the top of the transaction, compare against the requested
   quantities, and bail before the first write if any line is short. The
   `FOR UPDATE` row locks give the same serialisation the guarded UPDATE
   provides today, and the guarded `WHERE stock >= qty` should be **kept** as
   the belt-and-braces check.

3. **Escalate the oversold outcome.** It means a customer has been charged for
   an order that cannot be fulfilled. It must:
   - log at `error`, not `info` (`api/webhooks/stripe/route.ts:47`);
   - call `captureException` / Sentry;
   - ideally trigger an automatic `provider.refund()` — the money is already
     captured and the store cannot deliver. At minimum, surface it in the
     admin order list as a distinct, filterable state (see ECM-06's
     `cancelled`/`needs_review` work).

Also fix the confirmation page (ECM-10): `pending` + `failed` payment must not
claim "not charged" when the failure came from oversell.

### Dependências

- Do **after ARCH-05** (a single transition table) so the new
  `oversold`/`needs_review` state has one owner.
- Blocks nothing, but ECM-05 (restock on refund) reuses the inventory-log
  helper this fix introduces.

### Testes necessários

**These are the tests whose absence let this ship — write them first.**

1. Integration, multi-line oversell: order with line A (stock 5, qty 2) and
   line B (stock 0, qty 1) → `fulfillPaidOrder` returns `oversold`, **and**
   `variant A.stock === 5` (unchanged), **and** zero `inventory_log` rows
   reference the order, **and** `payment.status === 'failed'`, **and**
   `order.status === 'pending'`.
2. Integration, ordering-independence: the same test with the short line
   **first** — asserts the fix isn't accidentally order-dependent.
3. Integration, idempotency after oversell: call `fulfillPaidOrder` twice with
   the same `eventId` after an oversell → the second returns `duplicate` and
   still nothing is decremented.
4. Integration, happy multi-line: three lines all in stock → all decremented
   exactly once, three inventory-log rows, order `paid`.
5. Real-connection concurrency, multi-line: extend
   `orders-concurrency.test.ts` so both orders contain **two** items sharing
   one contended variant; assert exactly one `paid`, the other fully rolled
   back, and no stock drift on the uncontended variant.

---

## ECM-02 `draft` and `archived` products can be added to cart and purchased

**Confidence: Confirmed**

### Localização

- `packages/db/src/queries/cart.ts:123-172` (`addCartItem`) — reads
  `productVariant` only; never joins `product` to check `status`
- `packages/db/src/queries/orders.ts:57-97` (`createOrder`) — joins `product`
  at line 71 and selects `product.name`, but the `WHERE` at line 72 is only
  `eq(cartItem.cartId, cartId)`; `status` is never in the predicate
- `packages/db/src/queries/cart.ts:80-98` (`getCartDetail`) — same
- Contrast: `products.ts:144` (`eq(product.status, "active")`),
  `products.ts:263`, `products.ts:345`, `products.ts:393` all filter correctly

```
Linha aproximada: cart.ts:129  ·  orders.ts:72
```

### Problema

`product.status` gates **discovery** everywhere and gates **transaction**
nowhere. Every read path that finds a product filters `status = 'active'`; no
write path in the cart/checkout chain does.

Concretely, `addCartItem` takes a `variantId` and looks it up directly:

```ts
const [variant] = await db
  .select({ stock: productVariant.stock, priceOverrideCents: productVariant.priceOverrideCents })
  .from(productVariant)
  .where(eq(productVariant.id, variantId))
  .limit(1);
```

No join to `product`. So any valid variant UUID is addable, regardless of the
parent product's status. And `createOrder`'s re-validation — the function
whose entire job is *"re-validate every line against current DB state"* —
checks stock and price but not status.

Two live consequences:

**(a) Archive-after-add.** A customer adds an active product to their cart.
An admin archives it (`setProductStatusAction` → `archived`, the documented
soft-delete per `tasks.md` 7.2). The product vanishes from the catalog and
from search. The customer's cart still shows it — `getCartDetail` doesn't
filter either — and checkout completes normally. They buy a withdrawn product.

**(b) Draft leakage.** A `draft` product (never published) has a real variant
id from the moment it is created, because `createProductAdmin` auto-inserts a
`Default` variant (`admin-products.ts:177`). Anyone who obtains that UUID —
from a shared admin screenshot, a leaked staging URL, an admin who pasted a
link — can add it to a cart and buy it at whatever price is in `base_price_cents`,
which for an unfinished draft is frequently `0` (`ProductForm`'s default is
`basePriceCents: 0`, `product-form.tsx:35`).

The variant id is a UUIDv4, so this is not brute-forceable. It is a
*confused-deputy / stale-reference* class bug, not an enumeration one — but
case (a) needs no secret at all and happens on its own.

### Por que isso é um problema

`spec.md` §7 lists *"Admin deletes a category that still has products"* and
*"Item goes out of stock between add to cart and checkout"* as edge cases to
handle explicitly. "Admin withdraws a product between add-to-cart and
checkout" is the same class and is unhandled. Archiving is the project's
**only** delete mechanism for products (hard delete is impossible — an
`order_item` restrict FK blocks it), so "archived" is what "removed from sale"
means here. It currently means "removed from sale, except for anyone who
already has it in a cart, forever."

A draft product sold at a placeholder price is a direct revenue defect.

### Cenário que reproduz o problema

**(a)** As a guest, add "Iron Longsword" to the cart. In another browser, as
admin, go to `/admin/products`, click **Archive** on it. Back as the guest:
`/cart` still lists it; `/checkout` accepts it; the mock payment approves; the
order is `paid`; stock is decremented on an archived product. The catalog
shows nothing.

**(b)** As admin, create a product "Unreleased Blade", leave status `draft`,
leave base price `0`, save. Copy the `Default` variant's id from
`/admin/products/<id>` (it is in the DOM / in the network response). In an
incognito window call `addToCartAction({ variantId, quantity: 1 })`. The cart
now holds a $0.00 line for an unpublished product; checkout completes.

### Impacto

- Segurança: médio (a stale/leaked identifier grants a transaction the
  product state forbids)
- Correção: **alto** (sells withdrawn and unpublished inventory)
- Performance: nenhum
- Manutenção: médio
- UX: alto (customer receives an order for something the shop withdrew)

### Severidade

**P0**

### Recomendação

Enforce status at **all four** points, not just the last one:

1. **`addCartItem`** — join `product` and require `status = 'active'`:
   ```ts
   const [variant] = await db
     .select({ stock: productVariant.stock, priceOverrideCents: productVariant.priceOverrideCents,
               basePriceCents: product.basePriceCents, status: product.status })
     .from(productVariant)
     .innerJoin(product, eq(product.id, productVariant.productId))
     .where(and(eq(productVariant.id, variantId), eq(product.status, "active")))
     .limit(1);
   if (!variant) return { ok: false, reason: "unavailable", available: 0 };
   ```
   (This also removes the second query at `cart.ts:155-160` — the base price
   is now already fetched.) Widen `AddToCartResult` with an `unavailable`
   reason and surface it in `ProductVariantPanel`.

2. **`createOrder`** — add `status` to the selected columns and emit a new
   `StockOrPriceIssue` kind:
   ```ts
   | { productName: string; kind: "unavailable" }
   ```
   Render it in `CheckoutForm` as *"<name> is no longer available — remove it
   to continue."* This is the authoritative gate: even if a stale cart line
   exists, checkout refuses.

3. **`getCartDetail`** — return an `isAvailable: boolean` per line (do not
   silently hide the line; the customer needs to see and remove it). Render a
   disabled, greyed line in `CartLineItem` with a "No longer available —
   remove" affordance, and exclude it from the subtotal.

4. **`setProductStatusAdmin`** — when a product moves to `archived`, decide
   what happens to carts holding it. Two defensible options:
   - **(recommended)** leave the rows and let (3) render them as unavailable —
     the customer sees why their cart changed.
   - Delete the matching `cart_item` rows in the same transaction — cleaner
     data, but the cart silently shrinks with no explanation.
   Whichever is chosen, write it down: this is currently unspecified anywhere.

### Dependências

- Item 2 shares the `StockOrPriceIssue` union and the `CheckoutForm` rendering
  with the existing stock/price issues — do it in the same edit.
- Item 4 is a **product decision**; get it answered before implementing.

### Testes necessários

1. Integration: `addCartItem` for a `draft` product's variant →
   `{ok:false, reason:"unavailable"}`; no `cart_item` row created.
2. Integration: same for `archived`.
3. Integration: cart holds an active product's variant → admin archives the
   product → `createOrder` returns
   `{ok:false, reason:"stock_or_price_changed", issues:[{kind:"unavailable"}]}`
   and writes **no** order row.
4. Integration: `getCartDetail` marks the line unavailable and excludes it
   from `subtotalCents`.
5. E2E: add to cart → archive via the admin UI in a second context → the cart
   page shows the unavailable state and checkout is blocked with a clear
   message.

---

## ECM-03 Refund calls the payment provider before validating the order state machine

**Confidence: Confirmed**

### Localização

`apps/web/lib/actions/orders.ts:29-46`

```
Linha aproximada: 38
```

### Problema

```ts
const latestPayment = await getLatestPaymentForOrder(db, orderId);
if (!latestPayment) return { ok:false, reason:"not_found" };
if (latestPayment.status !== "succeeded") return { ok:false, reason:"invalid_state" };

const refundResult = await provider.refund(latestPayment.providerRef, latestPayment.amountCents);   // ← money moves here
if (!refundResult.ok) return { ok:false, reason:"provider_error", message: refundResult.reason };

const outcome = await markOrderRefunded(db, orderId, admin.id);   // ← state machine checked here
if (!outcome.ok) return outcome;   // ← "invalid_state" AFTER the money is gone
```

The external, irreversible side effect happens **before** the authoritative
state check, and the two checks use **different predicates**:

- the action checks `payment.status === 'succeeded'`
- `markOrderRefunded` (`queries/orders.ts:416-434`) checks
  `order.status ∈ {paid, fulfilled}`

Those can disagree. `fulfillPaidOrder` sets `payment.status = 'succeeded'`
unconditionally but sets `order.status = 'paid'` only
`WHERE order.status = 'pending'` (ECM-04). Any order that was not `pending`
at fulfilment time ends up with a `succeeded` payment and a non-paid status —
exactly the combination that passes the first check and fails the second.

There is also no compensating action if the process dies, or the DB is
unreachable, between the provider call and `markOrderRefunded`. Stripe has
refunded; the local DB says `paid`; there is no audit-log row, no retry, and
no reconciliation job.

### Por que isso é um problema

This is real money moving with no durable record. The audit log — which
`spec.md` §8 makes a success criterion (*"All state-changing admin actions
produce an audit log entry"*) — is written *inside* `markOrderRefunded`, so
the one path where a refund happens without a DB transition is also the one
path with no audit trail.

The admin sees `{ok:false, reason:"invalid_state"}` and reasonably concludes
nothing happened. They may click **Refund** again — and because
`payment.status` is still `succeeded`, the guard passes again and **a second
Stripe refund is attempted**. Stripe will usually reject a duplicate full
refund on the same payment intent, but the loop has no idempotency key and no
back-off.

### Cenário que reproduz o problema

1. An order reaches `payment.status = 'succeeded'` while `order.status` is not
   `paid`/`fulfilled`. The reachable route today: the ECM-01 oversold path
   leaves `payment.status = 'failed'` — so use the ECM-04 route instead: an
   order that was already moved out of `pending` (e.g. a future `cancelled`
   transition, or a manual DB correction) then receives a late webhook →
   `payment.status = 'succeeded'`, `order.status` unchanged.
2. Admin opens the order and clicks **Refund**.
3. `getLatestPaymentForOrder` → `succeeded` → guard passes.
4. `provider.refund(...)` → Stripe refunds the money. ✅
5. `markOrderRefunded` → `order.status` is not `paid`/`fulfilled` →
   `{ok:false, reason:"invalid_state"}`.
6. UI shows "Refund failed." DB still says `paid`. No audit row. Money gone.
7. Admin clicks **Refund** again → step 4 runs again.

Simpler variant with no precondition needed at all: kill the Postgres
connection (or the process) between steps 4 and 5. Same outcome.

### Impacto

- Segurança: baixo
- Correção: **alto** (money/ledger divergence, no audit trail)
- Performance: nenhum
- Manutenção: alto
- UX: alto (admin is told the refund failed when it succeeded)

### Severidade

**P1**

### Recomendação

Invert the order and make it recoverable:

1. **Validate first, in the database, atomically.** Move the order to an
   intermediate `refund_pending` state (or set a `refund_requested_at`
   column) inside a transaction that also checks the transition is legal and
   writes the audit row. If the transition is illegal, return before touching
   Stripe.
2. **Then call the provider.**
3. **Then commit the terminal state** (`refunded`) in a second short
   transaction, writing the provider's refund id.
4. **On provider failure**, roll the order back out of `refund_pending` and
   record the failure in the audit log — so there is always a record that a
   refund was attempted.
5. **Use one predicate.** Delete the `payment.status === 'succeeded'` check
   from the action and let `markOrderRefunded` be the single authority (fixing
   ECM-04 makes the two consistent anyway). Keep exactly one guard, in the
   layer that owns the state machine.
6. **Add idempotency.** Pass a deterministic idempotency key to
   `provider.refund` (Stripe supports `Idempotency-Key`; extend the
   `PaymentProvider.refund` signature to accept one, e.g. `refund:<orderId>`)
   so a retried click cannot double-refund.
7. **Store the refund reference.** `payment.provider_ref` currently keeps the
   payment-intent id; add the refund id (a second column or a `refunds` jsonb)
   so the ledger can be reconciled against Stripe.

If a full `refund_pending` state is judged too heavy, the minimum acceptable
fix is: **check the order-status precondition before calling the provider**
(a `SELECT` at the top of the action), and write an audit row on the
provider-failure and DB-failure branches too.

### Dependências

- **ARCH-05** (single transition table) should land first — this fix adds a
  state and must not add a fifth place that encodes transitions.
- **ECM-04** must be fixed too, otherwise the `succeeded`/not-`paid`
  divergence that triggers this remains reachable.
- Extending `PaymentProvider.refund` with an idempotency key touches
  `packages/payments` and both implementations.

### Testes necessários

1. Integration: refunding an order whose status is not `paid`/`fulfilled`
   → the provider's `refund` is **never called** (assert on a spy) and a typed
   `invalid_state` is returned.
2. Integration: provider `refund` rejects → order status is unchanged, an
   audit row records the attempt and the failure.
3. Integration: provider succeeds, then the DB write is forced to fail → the
   order is left in a recoverable state with an audit row; a retry does not
   call the provider a second time.
4. Integration: two concurrent `refundOrderAction` calls for the same order →
   exactly one provider call.
5. Existing E2E (`admin-journey.spec.ts` "admin fulfills then refunds") must
   keep passing.

---

## ECM-04 `payment.status` is set to `succeeded` even when the order is not transitioned

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`packages/db/src/queries/orders.ts:353-360`

```ts
await tx.update(payment)
  .set({ status: "succeeded", providerRef: event.providerRef, updatedAt: new Date() })
  .where(eq(payment.orderId, event.orderId));           // ← unconditional, and ALL rows
await tx.update(order)
  .set({ status: "paid", updatedAt: new Date() })
  .where(and(eq(order.id, event.orderId), eq(order.status, "pending")));   // ← conditional
```

### Problema

The payment update has no status precondition; the order update does. If the
order is not `pending` when the event arrives, the payment is marked
`succeeded` and the order keeps its old status — and the function still
returns `{ outcome: "paid" }`, so the caller sends a confirmation email
(`route.ts:48`, `mock-checkout.ts:33`) for an order that was not transitioned.

Reachable whenever a webhook arrives late relative to another status change —
which becomes much more likely once ECM-06 adds `cancelled` (an expired
session cancels the order; a late `checkout.session.completed` then arrives).

This divergence is the precondition that makes **ECM-03** exploitable.

Secondary issue in the same two statements: both `UPDATE`s target
**every** payment row for the order (`WHERE order_id = …`), not the specific
payment being confirmed. `payment` is deliberately modelled 1:many
(`schema/payment.ts:19-23`) for future partial capture/refunds. The moment a
second row exists, one webhook marks them all succeeded. Same pattern in
`markOrderRefunded` (`orders.ts:424`) and `recordPaymentFailure`
(`orders.ts:386-389`). Tracked as **DB-06**.

### Impacto

Correção: alto · Manutenção: médio · UX: médio (a confirmation email for an
order that isn't paid) · Segurança: baixo

### Recomendação

1. Read the order's current status at the top of the transaction and decide
   explicitly. If it is not `pending`, return a new outcome
   (`{ outcome: "not_pending", currentStatus }`) **without** touching payment
   or order, log at `warn`, and do not send email.
2. Target the payment update by its **id**, resolved from
   `providerRef`/`orderId`, not by `orderId` alone.
3. Route the transition through `assertTransition` from ARCH-05.

### Testes necessários

- Integration: an order in `fulfilled` receives a `checkout_completed` event →
  no status change on either table, outcome is `not_pending`, no email sent.
- Integration: two payment rows for one order → confirming one leaves the
  other untouched.

---

## ECM-05 Refunds neither restore stock nor write an inventory-log entry

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`packages/db/src/queries/orders.ts:416-434` (`markOrderRefunded`)

### Problema

`markOrderRefunded` updates `order.status`, `payment.status` and writes an
audit row. It does **not**:

- increment `product_variant.stock` back for the refunded lines,
- write `inventory_log` rows (there is no `refund` value in
  `inventoryChangeReasonEnum` — only `order`, `restock`, `adjustment`,
  `schema/ops.ts:6-10`).

So refunded goods leave inventory permanently. The store's stock count drifts
down by one unit per refunded item forever, and the low-stock dashboard
(`lowStockAlerts`) reports shortages that don't exist.

This also conflicts with `spec.md` §5 item 13: *"Inventory tracking —
per-variant stock, decremented transactionally on paid orders, **all changes
recorded in an inventory log**."* A refund is a change; it isn't recorded.

### Why this is P2 and not P1

It is a **Question** as much as a defect: whether a refund returns stock is a
genuine business decision (damaged goods, digital items, restocking fees).
Nothing in `spec.md`, `plan.md` or `architecture.md` states the intended
behaviour. What is *not* defensible is that the decision is implicit and
undocumented, and that the inventory log has no way to express it.

### Recomendação

1. **Decide and document** in `spec.md` §7 alongside the other refund edge
   case. Recommended default for this shop: restore stock, since refunds here
   are admin-initiated cancellations of physical goods.
2. Add `"refund"` to `inventoryChangeReasonEnum` (needs a migration —
   `ALTER TYPE inventory_change_reason ADD VALUE 'refund'`).
3. In `markOrderRefunded`'s transaction: read the order's items, increment
   each variant's stock, write one `inventory_log` row per line with
   `reason: 'refund'`, `change: +qty`, `referenceId: orderId`.
4. Guard against double-restock: the transition guard already forbids
   refunding twice (`paid|fulfilled → refunded` only), which is sufficient
   once ARCH-05 centralises it.
5. Revalidate the affected product pages (ARCH-01's tag list).

### Testes necessários

- Integration: refund a 2-item order → both variants' stock is back to the
  pre-order value, two `inventory_log` rows with `reason='refund'` exist.
- Integration: refunding an already-`refunded` order is rejected and does not
  restock a second time.
- Integration: `lowStockAlerts` reflects the restored stock.

---

## ECM-06 `pending → cancelled` is never reachable; abandoned and expired orders accumulate forever

**Confidence: Confirmed** · **Severidade: P2**

### Localização

- `packages/db/src/schema/order.ts:18-24` — `cancelled` exists in the enum
- `apps/web/app/api/webhooks/stripe/route.ts:50-52` — `checkout_failed` →
  `recordPaymentFailure`
- `packages/db/src/queries/orders.ts:374-392` (`recordPaymentFailure`) — sets
  `payment.status = 'failed'`, comment: *"leaves the order `pending` so the
  customer can retry from checkout"*
- `packages/payments/src/providers/stripe.ts:91-96` — maps
  `checkout.session.expired` → `checkout_failed`
- Repo-wide grep for `"cancelled"`: only the enum definition and the admin
  filter button list (`admin/orders/page.tsx:17`)

### Problema

`plan.md` §9 defines `pending → cancelled` as a valid transition for
*"(expired/abandoned)"* orders. No code performs it. `cancelled` is a dead
enum value with a filter button in the admin UI that will always show zero
results.

Every abandoned checkout therefore leaves a permanent `pending` order:

- The customer clicks Pay, then closes the tab → order `pending`, no payment
  event ever arrives → `pending` forever.
- Stripe's session expires (24 h) → `checkout.session.expired` →
  `recordPaymentFailure` → `payment.status = 'failed'`, order **still**
  `pending`.
- Every rate-limited-away retry, every ECM-07 duplicate submit → another
  `pending` order.

`spec.md` §7 says: *"Stripe Checkout Session expires or user abandons payment
→ order remains `pending`, a scheduled/admin-visible state, not silently
lost."* The first half is implemented (they are visible in
`/admin/orders?status=pending`). The "scheduled" half — anything that ever
moves them out — is not. The admin UI offers **no cancel action at all**:
`OrderActions` returns `null` unless the status is `paid` or `fulfilled`
(`components/admin/order-actions.tsx:39`).

Downstream effects: `revenueOverTime` and `topProductsByRevenue` correctly
exclude `pending`, so reporting is fine. But the pending pile grows without
bound, is indistinguishable between "abandoned three months ago" and "paying
right now", and there is no operational way to clear it.

### Recomendação

1. Add `cancelOrder(db, orderId, actorId, reason)` in `packages/db`,
   transitioning `pending → cancelled`, writing an audit row.
2. Call it from `recordPaymentFailure`'s **expired** path specifically —
   distinguish `checkout.session.expired` (terminal: cancel) from a
   payment failure the customer can retry (`payment_intent.payment_failed`,
   which is not currently handled at all). Today
   `packages/payments/src/providers/stripe.ts` maps only `completed` and
   `expired`; a genuine card decline produces no event this app understands.
3. Add an admin **Cancel order** button for `pending` orders, and show the
   order's age in the list so stale ones are obvious.
4. Add a sweeper (a documented manual command is enough at this scale, e.g.
   `pnpm --filter @medivi/db orders:expire`) that cancels `pending` orders
   older than N hours. Document N in `spec.md`.
5. Make sure cancelling **does not** decrement or restore stock — a `pending`
   order never decremented anything.

### Dependências

**ARCH-05** first. **FE-01** step 2 depends on this (it wants to cancel an
order when the provider call fails).

### Testes necessários

- Integration: `cancelOrder` on `pending` → `cancelled` + audit row; on `paid`
  → rejected, no change.
- Integration: `checkout.session.expired` webhook → order `cancelled`,
  payment `failed`, no stock touched.
- Integration: a cancelled order cannot later be marked `paid` by a late
  webhook (this is ECM-04's guard working).
- E2E: an admin can cancel a pending order from the order detail page.

---

## ECM-07 Checkout has no idempotency — one cart can produce many orders, and more than one can be paid

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`apps/web/lib/actions/checkout.ts:33-78`; `packages/db/src/queries/orders.ts:51-144`

### Problema

`checkoutAction` unconditionally creates a new `order` + `order_items` +
`payment` and redirects. There is no idempotency key, no check for an existing
`pending` order for this cart, and no `unique` constraint that would prevent
one. The only brake is the rate limiter (10/min per client IP — and that key
is spoofable, SEC-04).

Three reachable multiplications:

1. **Double-click / slow network.** `disabled={isSubmitting}` covers the
   common case, but a failed action that throws (FE-01) re-enables the button
   with no error shown, and users retry. Each retry = one more `pending` order
   + `payment` row.
2. **Two tabs.** Open `/checkout` twice, submit both. Two orders, both from
   the same `cartId`, both valid, both with live Stripe sessions.
3. **Back button.** Redirect to Stripe, press Back, submit again.

If two of these orders are actually paid, `fulfillPaidOrder` runs twice with
different `eventId`s, so idempotency does not help: **stock is decremented
twice** and the customer is charged twice. The cart-clear at
`orders.ts:362-365` runs for whichever order pays first; the second order's
`cartId` still points at the (now empty) cart, which is harmless.

`spec.md` §5 item 6 explicitly promises *"idempotent order creation"*. It
isn't.

### Recomendação

Pick one of two mechanisms (the first is simpler and sufficient here):

- **(A) Reuse the open order.** Before creating, look for an existing
  `pending` order for this `cartId` whose line items still match the cart's
  contents and whose `payment.status = 'requires_payment'`. If found, reuse it
  — re-create or reuse the provider session and redirect. Requires an index on
  `order.cart_id` (DB-01) and a partial unique index
  `UNIQUE (cart_id) WHERE status = 'pending'`.
- **(B) Client-generated idempotency key.** The form mints a UUID on mount and
  sends it; `order.idempotency_key` is `UNIQUE`; a duplicate insert returns
  the existing order. More robust, more moving parts.

In both cases also:
- disable the submit button for the whole `startTransition`, not just RHF's
  `isSubmitting`;
- when a *new* order supersedes an old `pending` one for the same cart, cancel
  the old one (needs ECM-06).

### Dependências

**ECM-06** (to cancel superseded orders), **DB-01** (index on `order.cart_id`),
**FE-01** (so failures stop silently inviting retries).

### Testes necessários

- Integration: two sequential `checkoutAction` calls with the same cart →
  exactly one `pending` order row.
- Integration: two *concurrent* calls (real connections, like
  `orders-concurrency.test.ts`) → exactly one order; the loser reuses it.
- Integration: after the cart changes, a new checkout creates a new order and
  cancels the stale one.
- E2E: submit checkout, press Back, submit again → one order in
  `/admin/orders`.

---

## ECM-08 `createOrder` validates and writes in two separate transactions

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`packages/db/src/queries/orders.ts:57-141` — the `SELECT` at 57-72 is outside
the `db.transaction` that begins at line 103.

### Problema

The stock/price re-validation reads rows with no lock, outside a transaction.
The order is then written inside a transaction that re-reads nothing. Between
the two, an admin can change a price and a concurrent order can consume stock.

For **stock** this is acceptable and deliberate — `architecture.md` §4 is
explicit that add-to-cart and checkout checks are soft, and the guarded
decrement at fulfilment is the hard guarantee. Keep that design.

For **price** it is not covered by any later guard. If `base_price_cents`
changes in the window, the order is written at the stale snapshot price and
`fulfillPaidOrder` never re-checks price. The customer is charged the amount
the provider session was created with (the stale total), which is at least
self-consistent — but the store may have sold below the new price without
noticing.

The window is milliseconds and requires an admin price change to land inside
it, so real-world likelihood is very low.

### Recomendação

Move the validation `SELECT` inside the transaction and add `FOR SHARE` on the
product/variant rows (or `FOR UPDATE` if ECM-01's pre-check lands there too),
so the read is consistent with the write. This is a ~5-line change with no
behavioural risk. Do it in the same pass as ECM-01, which is already
restructuring this transaction.

### Testes necessários

- Integration: with a price change committed between the read and the write
  (simulate by wrapping in a transaction and updating from a second
  connection), the order is either rejected or written at the new price —
  never at a price no longer in the DB.

---

## ECM-09 Guest→user cart merge is not transactional and silently discards items

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`packages/db/src/queries/cart.ts:223-278`

### Problema

Two defects in one function:

**(a) No transaction.** The merge performs up to `2 + 3N` separate statements
— fetch guest cart, fetch guest items, get-or-create the user cart, fetch user
items, fetch stock, then one UPDATE or INSERT per item, then
`DELETE FROM cart WHERE id = guestCart.id`. None of it is wrapped in
`db.transaction`. A failure at any point (connection drop, constraint
violation, process restart) leaves a half-merged state: some items copied, the
guest cart still present, and the cookie already cleared by the caller
(`actions/cart.ts:80` runs `clearGuestCartCookie()` after the merge returns —
but if the merge *throws*, the cookie survives and a retry re-merges the
already-copied items, doubling quantities up to the stock clamp).

**(b) Silent data loss.** Line 258:
```ts
const combinedQuantity = Math.min((existing?.quantity ?? 0) + guestItem.quantity, stock);
if (combinedQuantity <= 0) continue;
```
If a variant's stock has dropped to `0` since the guest added it, `stock` is
`0`, `combinedQuantity` is `0`, and the item is **dropped with no record and
no user-facing message**. The clamp behaviour matches `spec.md` §7
(*"quantities sum, clamped to available stock"*) but the spec doesn't
contemplate clamping to zero, and the user is never told. They sign in and
find items missing.

Same for partial clamping: guest had 5, stock is now 2 → they silently get 2.

Also note `mergeGuestCartIntoUserCart` never updates `price_snapshot_cents`
for a line that already exists in the user's cart — the user's older snapshot
wins. That is arguably correct (the earlier snapshot is the earlier promise)
but it is undocumented and asymmetric with the insert branch, which carries
the *guest's* snapshot over.

### Recomendação

1. Wrap the whole function body in `db.transaction`, including the guest-cart
   delete. Move `clearGuestCartCookie()` to run only after the merge resolves
   successfully (it already does — but make the ordering explicit and add a
   comment, since the failure mode is subtle).
2. Return a summary instead of `void`:
   ```ts
   type MergeResult = { merged: number; clamped: {productName:string; requested:number; got:number}[]; dropped: string[] };
   ```
   and surface it after sign-in as a toast/banner: *"2 items were adjusted to
   available stock; 1 item is no longer available."* The `Toaster` is already
   mounted in the root layout.
3. Decide and document the price-snapshot rule for merged duplicates.

### Testes necessários

- Integration: guest 3 + user 2 of a variant with stock 4 → result 4, and the
  returned summary reports the clamp.
- Integration: guest item whose variant now has stock 0 → not merged, reported
  as `dropped`.
- Integration: force a failure mid-merge (e.g. a variant deleted between
  reads) → assert the guest cart is intact and nothing was partially copied.
- Existing E2E (`auth-journey.spec.ts` guest-cart-merge) must keep passing.

---

## ECM-10 The confirmation page shows "Thank you for your order!" for refunded orders, and nothing for cancelled ones

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`apps/web/app/(storefront)/order/confirmation/[id]/page.tsx:21-23`

```ts
const isPaid      = order.status === "paid" || order.status === "fulfilled" || order.status === "refunded";
const isFailed    = order.status === "pending" && order.latestPaymentStatus === "failed";
const isProcessing = order.status === "pending" && !isFailed;
```

### Problema

Three issues in three lines:

1. **`refunded` is bucketed as `isPaid`**, so a customer revisiting the link
   after a refund sees *"Thank you for your order!"* and *"A confirmation has
   been recorded for order MDV-…"*. The `OrderDetailCard` below does show
   `Status: refunded`, so the page contradicts itself.
2. **`cancelled` matches none of the three branches** — the page renders the
   order card with no heading and no explanation at all. (Unreachable today
   because nothing sets `cancelled`; becomes live with ECM-06.)
3. **`isFailed`'s copy is wrong for the oversold case.** After ECM-01's
   scenario the order is `pending` with a `failed` payment, so the page says
   *"Order X was not charged"* — but the customer **was** charged. See ECM-01.

Additionally, `CheckoutCompletedBeacon` fires for `isPaid`, so a refunded
order re-fires a `checkout_completed` analytics event on every visit.

### Recomendação

Replace the three booleans with an exhaustive `switch` on `order.status`
(TypeScript will then force every enum member to be handled):

| status | payment | Message |
|---|---|---|
| `paid` / `fulfilled` | — | Thank you for your order |
| `refunded` | — | This order was refunded — with the refund date and amount |
| `cancelled` | — | This order was cancelled — link back to the catalog |
| `pending` | `failed` | Payment did not complete — retry (only when genuinely not charged) |
| `pending` | `succeeded` | **Needs attention** — we're sorting this out, contact support (the ECM-01 case) |
| `pending` | other | Processing — the poller keeps running |

Gate `CheckoutCompletedBeacon` on `paid`/`fulfilled` only.

Also bound `OrderStatusPoller`: it currently refreshes every 2 s for 20 s
(`components/order-status-poller.tsx:11-12`) and then simply stops, leaving a
stuck "Payment processing" page with no further action. Add a terminal state
after the timeout: *"Still processing — we'll email you. Refresh or look up
your order."*

### Testes necessários

- Component/E2E: a `refunded` order renders the refunded message and no
  thank-you.
- Component: a `cancelled` order renders the cancelled message.
- Component: `pending` + `succeeded` payment renders the needs-attention state.
- Component: the analytics beacon does not fire for `refunded`.

---

## Remaining e-commerce findings (P3)

| ID | Finding | Localização | Impacto & Recomendação |
|---|---|---|---|
| **ECM-11** | `order.cart_id` is `ON DELETE SET NULL`. `mergeGuestCartIntoUserCart` **deletes** the guest cart row. So a guest who creates a pending order and then signs in (in another tab, or via the "sign in for order history" prompt) has `order.cart_id` nulled — and when the payment later lands, `fulfillPaidOrder`'s cart-clear at `orders.ts:362-365` finds nothing to clear. Their newly-merged user cart keeps the purchased items. | `schema/order.ts:53`, `queries/cart.ts:277`, `queries/orders.ts:362` | Correção: baixo, UX: médio (duplicate items after purchase). Fix by re-pointing open orders at the surviving cart during the merge (`UPDATE "order" SET cart_id = <userCartId> WHERE cart_id = <guestCartId> AND status = 'pending'`) inside ECM-09's new transaction. |
| **ECM-12** | Currency is modelled on `product`, `order`, `payment` and `cart`, but `createOrder` hardcodes `"USD"` and never reads it. `formatPriceCents` defaults to `"USD"` and always formats with the `en-US` locale. | `queries/orders.ts:116`, `lib/format.ts:2` | Manutenção: médio. `spec.md` §6 makes multi-currency a non-goal, so this is consistent with the spec — but the code should read `product.currency` and add a `CHECK`/validation that all lines of one order share a currency, so the model and the code stop disagreeing. See BE-10. |
| **ECM-13** | `order.tax_cents` is always `0`. No tax rules, no tax-inclusive/exclusive concept. | `queries/orders.ts:114` | Correção: nenhum (out of scope per `spec.md` §2 single-region). Add a one-line comment at the call site so the next reader doesn't hunt for the missing calculation, and note it in `spec.md` §6 Non-Goals, which currently doesn't mention tax at all. |
| **ECM-14** | There is no maximum order value, no maximum line quantity beyond `addToCartSchema`'s `.max(99)`, and no fraud/velocity signal of any kind. A single order can be for 99 × the most expensive item on every line. | `lib/actions/cart.ts:23` | Segurança: baixo (this is a fictional store with mock payments). **Recommendation**, not a defect: if a "real store" narrative matters for the portfolio, a documented per-order cap and a note about where fraud checks would hook in is a cheap, high-signal addition. |
| **ECM-15** | Wishlist → cart is not implemented. `spec.md` §3.2 lists *"Manage wishlist, move wishlist item to cart"* as a returning-customer journey; `/wishlist` renders `ProductCard`s that only link to the product page. | `app/(account)/wishlist/page.tsx`, `components/product-card.tsx` | UX: baixo, Manutenção: baixo. Either build it (the wishlist page has product ids; it needs a variant choice, so it should link to the product page with the panel focused, not add blindly) or strike the sentence from `spec.md` §3.2. |
