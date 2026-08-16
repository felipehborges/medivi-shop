# 03 — Backend (Server Actions, Route Handlers, contracts)

Findings: `BE-01` … `BE-11`, `VAL-01`, `VAL-02`, `SEC-12` (cross-referenced).
(`BE-09` is documented in [`02-frontend.md`](02-frontend.md) because it spans
both layers.)

---

## 1. Inventory of server entry points

### 1.1 Server Actions (35 across 12 files)

| File | Actions | Guard | Zod | Returns typed result |
|---|---|---|---|---|
| `actions/cart.ts` | `addToCartAction`, `updateCartItemAction`, `removeCartItemAction`, `mergeCartOnLogin` | none / none / none / `requireUser` | ✅ `.parse` | ✅ (throws on invalid input) |
| `actions/checkout.ts` | `checkoutAction` | none (guest allowed) | ✅ `.parse` | partial — see FE-01 |
| `actions/mock-checkout.ts` | `approveMockPayment`, `declineMockPayment` | **none** ❌ | ✅ `.parse` | n/a (redirects) |
| `actions/orders.ts` | `fulfillOrderAction`, `refundOrderAction` | `requireAdmin` ✅ | ✅ | ✅ |
| `actions/order-lookup.ts` | `lookupGuestOrderAction` | none (by design) | ✅ | ✅ |
| `actions/wishlist.ts` | `toggleWishlist` | `requireUser` ✅ | ✅ | void |
| `actions/addresses.ts` | create/update/delete | `requireUser` ✅ | ✅ | void |
| `actions/admin-products.ts` | 5 actions | `requireAdmin` ✅ | ✅ | ✅ |
| `actions/admin-variants.ts` | 4 actions | `requireAdmin` ✅ | ✅ | partial |
| `actions/admin-categories.ts` | 3 actions | `requireAdmin` ✅ | ✅ | ✅ |
| `actions/admin-banners.ts` | 3 actions | `requireAdmin` ✅ | ✅ | void |
| `actions/admin-users.ts` | `setUserRoleAction` | `requireAdmin` ✅ | ✅ | ✅ |

**Verified:** every one of the 20 admin actions calls `requireAdmin()` as its
*first* statement, before parsing input. This satisfies the CLAUDE.md
non-negotiable and is tested (`admin-*.test.ts` each assert a non-admin
caller is rejected). Good.

**The two unguarded exceptions** — `approveMockPayment` / `declineMockPayment`
— are the subject of **SEC-01** (P0).

Cart actions being unauthenticated is correct: guests have carts. Ownership is
enforced at the query layer, which scopes every mutation by the resolved
`cartId` (`queries/cart.ts:189, 208, 215`). No IDOR there — verified.

### 1.2 Route Handlers (3)

| Route | Purpose | AuthN | Rate limit | Validation |
|---|---|---|---|---|
| `api/auth/[...all]` | Better Auth catch-all | Better Auth | Better Auth built-in (prod only) | Better Auth |
| `api/webhooks/stripe` | payment events | HMAC signature ✅ | 100/min per IP ⚠️ (SEC-04) | provider-verified |
| `api/analytics/track` | beacon sink | **none** | **none** ❌ (SEC-05) | ✅ Zod |

### 1.3 HTTP status codes

Route Handlers are the only place status codes are chosen:

| Situation | Code | Verdict |
|---|---|---|
| Webhook rate-limited | 429 | ✅ (Stripe will retry) |
| Webhook bad/missing signature | 400 | ✅ (Stripe will not retry — correct, a bad signature is never transient) |
| Webhook unknown event type | 200 | ✅ (documented; prevents infinite Stripe retries) |
| Webhook processed | 200 | ✅ |
| Analytics malformed body | 400 | ✅ |
| Analytics DB insert failure | **200** | ⚠️ — the insert error is caught and logged, then `{ok:true}` is returned. Deliberate ("best-effort") but the client can't distinguish. Acceptable; see BE-08. |

Server Actions return typed unions rather than status codes, which is the
right model. Pages use `notFound()` (404) and `redirect()` (307) consistently.

---

## VAL-01 No Zod string has a maximum length; no number has an upper bound

**Confidence: Confirmed**

### Localização

Every schema file:
- `apps/web/lib/schemas/checkout.ts:5-19` — `fullName`, `line1`, `line2`,
  `city`, `region`, `postalCode`, `country`, `guestEmail`
- `apps/web/lib/schemas/address.ts:3-12` — same fields
- `apps/web/lib/schemas/product.ts:3-18` — `name`, `slug`, `description`,
  `longDescription`, `material`, `seoTitle`, `seoDescription`;
  `basePriceCents: z.number().int().min(0)` with no `.max()`
- `apps/web/lib/schemas/category.ts:3-12`
- `apps/web/lib/schemas/banner.ts:3-14`
- `apps/web/lib/schemas/variant.ts:3-15` — `name`, `sku`;
  `delta: z.coerce.number().int()` with no bounds
- `apps/web/lib/schemas/order-lookup.ts:3-6` — `orderNumber`

### Problema

Two distinct classes of unbounded input:

**(a) Unbounded strings.** Every column they land in is Postgres `text`
(effectively 1 GB). The only ceiling is Next's Server-Action body limit
(1 MB by default — not configured here, so the default applies). So an
unauthenticated guest can put ~1 MB of text into `shippingAddress.fullName`,
which is then:
- stored in `order.shipping_address` (jsonb),
- rendered on the confirmation page, the account order page and the **admin**
  order page (`OrderDetailCard`),
- interpolated into the order-confirmation **email** and sent via Resend.

**(b) Unbounded numbers against `integer` columns.** `basePriceCents`,
`priceOverrideCents`, `sortOrder` and stock `delta` all map to Postgres
`integer` (max 2,147,483,647). A value above that raises SQLSTATE `22003`,
which none of the `pg-errors.ts` helpers match, so it propagates as an
unhandled `DrizzleQueryError` → 500 → admin `error.tsx`. `adjustStockAction`
with `delta = 3000000000` is a two-second reproduction.

### Por que isso é um problema

- **Storage/cost amplification** by an unauthenticated actor, bounded only by
  the rate limiter (10 checkouts/min per IP — and that IP key is spoofable,
  SEC-04). 10 × 1 MB/min sustained.
- **Downstream blast radius**: an admin opening `/admin/orders` renders the
  1 MB string; the email provider receives a >1 MB HTML body and Resend
  rejects it, so the *legitimate* confirmation emails for that order silently
  fail (they're best-effort, logged only).
- **Trivially-triggered 500s** on admin pages via out-of-range integers.

Note this is not an injection risk — Drizzle parameterises everything, and
React escapes on render. It is availability/cost/robustness.

### Cenário que reproduz o problema

```bash
# Guest checkout with a 500 KB name — no auth required.
# (Via the browser console on /checkout, or by invoking the Server Action.)
fullName = "A".repeat(500_000)
```
Complete checkout. Then, as an admin, open `/admin/orders/<id>` — the page
renders half a megabyte of "A". Check the logs: the confirmation email
failed.

For the numeric case: `/admin/products/<id>` → set a variant restock quantity
to `3000000000` → **Restock +** → 500 page, no useful error.

### Impacto

- Segurança: médio (resource amplification, unauthenticated)
- Correção: médio (500s, failed emails)
- Performance: médio
- Manutenção: baixo
- UX: médio (admin sees a broken page)

### Severidade

**P2**

### Recomendação

1. Add explicit `.max()` to every string, sized to its column's real-world
   purpose. Suggested baseline:
   | Field | Max |
   |---|---|
   | `fullName`, `city`, `region`, `country` | 100 |
   | `line1`, `line2` | 200 |
   | `postalCode` | 20 |
   | `guestEmail`, any email | 254 (RFC 5321) |
   | product/category/banner `name`/`title` | 200 |
   | `slug` | 100 |
   | `description`, `subtitle`, `seoDescription` | 500 |
   | `longDescription` | 5000 |
   | `material`, variant `name` | 100 |
   | `sku` | 64 |
   | `orderNumber` | 64 |
   | `ctaLabel` | 50 · `ctaHref`, `imageUrl` | 2048 |
2. Add `.max()` to every integer field: prices `≤ 100_000_000` ($1M),
   `sortOrder` `-1000..1000`, stock `delta` `-100_000..100_000`.
3. Mirror the important ones as DB `CHECK` constraints
   (`length(name) <= 200`) so the invariant survives a future caller that
   forgets the schema. At minimum do this for the three fields that reach
   email: order `shipping_address` subfields.
4. Add `22003` (`numeric_value_out_of_range`) to `packages/db/src/lib/pg-errors.ts`
   as `isNumericOutOfRange`, and map it to a typed result in `adjustStockAdmin`
   and the product/variant save paths.

### Dependências

Independent. Do early — it's cheap and reduces the blast radius of several
other findings.

### Testes necessários

- Unit per schema: a string one character over the limit is rejected with the
  intended message.
- Integration: `adjustStockAdmin` with `delta = 2**31` returns a typed
  `out_of_range` result and leaves stock unchanged.
- Integration: `createOrder` with an over-long `fullName` is rejected at the
  action boundary before any row is written.

---

## VAL-02 `variantSchema.priceOverrideCents` coerces an empty string to `0`

**Confidence: Confirmed** (the schema); **Likely** for exploitability today

### Localização

`apps/web/lib/schemas/variant.ts:6`

```ts
priceOverrideCents: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
```

### Problema

`z.coerce.number()` applies `Number(input)` **before** validation, and
`Number("") === 0`. So for input `""` the first branch of the union succeeds
with the value `0`, and the `.or(z.literal(""))` branch is never reached — it
is dead code that looks like it handles the empty case.

The result is `priceOverrideCents: 0`, not `undefined`. Downstream:

- `updateVariantAdmin` (`queries/admin-variants.ts:50-54`) writes `0`, not NULL.
- `getProductBySlug` computes `priceCents: v.priceOverrideCents ?? row.basePriceCents`
  (`queries/products.ts:300`). `0 ?? base` is **`0`** — `??` only falls back on
  `null`/`undefined`.
- `addCartItem` computes `variant.priceOverrideCents ?? product_?.basePriceCents ?? 0`
  (`queries/cart.ts:161`) → `0`.
- `createOrder` re-validates `currentPriceCents = priceOverrideCents ?? basePriceCents`
  → `0`, which **matches** the cart snapshot of `0`, so the price-drift guard
  passes cleanly.

Net: a variant whose price override was "cleared" becomes free, and the
checkout guard specifically designed to catch price anomalies waves it
through.

### Why "Likely" rather than "Confirmed" as an exploit

The only current caller is `VariantManager`, which pre-empts the bug at
`components/admin/variant-manager.tsx:81`:
`priceOverrideCents: priceOverride ? Number(priceOverride) : undefined`.
Empty string → `undefined`, so the schema's `.optional()` branch runs and NULL
is written. **Today the bug is latent, not live.**

It becomes live the moment: (a) an edit-variant UI is added (`updateVariantAction`
exists but has no UI — BE-06), (b) anyone calls the action directly with `""`,
or (c) the form is refactored to pass raw input.

### Cenário que reproduz o problema

```ts
await createVariantAction({ productId, name: "Small", sku: "X-S", priceOverrideCents: "" as never });
// variant.price_override_cents === 0
// → product page shows $0.00, add-to-cart snapshots 0, checkout accepts it,
//   order total = shipping only.
```

### Impacto

- Segurança: baixo
- Correção: **alto if triggered** (products sold for free; the price-drift
  guard cannot detect it)
- Manutenção: alto (the code reads as if it handles `""` and doesn't)
- Others: nenhum

### Severidade

**P2** (latent — would be P0 if an edit UI existed)

### Recomendação

```ts
priceOverrideCents: z
  .union([z.literal(""), z.null(), z.undefined()])
  .transform(() => null)
  .or(z.coerce.number().int().min(1).max(100_000_000)),
```
Note `.min(1)`, not `.min(0)` — a *deliberate* zero-price override should be
expressed as "free" explicitly, not as a coincidence of an empty field. If
free products are wanted, add an explicit `isFree` flag.

Then remove the `??` hazard: change the two read sites to an explicit null
check, e.g. `v.priceOverrideCents === null ? basePrice : v.priceOverrideCents`,
so a legitimate `0` can never silently fall through either.

### Dependências

Do together with **BE-06** (build or delete the variant-edit path), and
before any work on **BE-03** (SKU error typing) since both touch this file.

### Testes necessários

- Unit: `variantSchema.parse({name,sku,priceOverrideCents:""})` yields `null`.
- Unit: `variantSchema.parse({… : "0"})` is **rejected**.
- Integration: a variant with `price_override_cents = 0` forced directly into
  the DB is priced at the base price by `getProductBySlug` (or, if free
  products are supported, that this is intentional and consistent through
  cart → order).

---

## BE-01 `Number(searchParams.page)` produces `NaN` → SQL error → 500 on every admin list page

**Confidence: Confirmed**

### Localização

- `apps/web/app/(admin)/admin/products/page.tsx:27` — `page: params.page ? Number(params.page) : 1`
- `apps/web/app/(admin)/admin/orders/page.tsx:24`
- `apps/web/app/(admin)/admin/users/page.tsx:20`
- `apps/web/app/(admin)/admin/audit-log/page.tsx:24`
- Consumed by `queries/admin-products.ts:57`, `admin-orders.ts:36`,
  `admin-users.ts:27`, `admin-audit.ts:39` — all `Math.max(1, params.page ?? 1)`

### Problema

`Number("abc")` is `NaN`. `NaN` is not `undefined`, so `?? 1` does not apply.
`Math.max(1, NaN)` is **`NaN`** (`Math.max` propagates NaN). The value then
flows into:

```ts
.limit(pageSize).offset((page - 1) * pageSize)   // offset(NaN)
```

Drizzle emits `offset NaN`, which Postgres rejects with a syntax/parameter
error. Nothing catches it → the admin `error.tsx` boundary renders
"Something went wrong".

The storefront is **not** affected: `catalog-view.tsx:29-32` has a proper
`parsePage` using `Number.isInteger(parsed) && parsed > 0`. The admin pages
simply didn't reuse it.

### Cenário que reproduz o problema

Signed in as admin, visit any of:

```
/admin/products?page=abc
/admin/orders?page=
/admin/users?page=1.5
/admin/audit-log?page=%20
```

`?page=` (empty) is falsy so it takes the `: 1` branch — safe. `?page=abc`,
`?page=1.5` and `?page=NaN` all break. `1.5` gives `offset 10` (fractional
`(0.5)*20`) → Postgres rejects a non-integer OFFSET.

It is also reachable without typing a URL: `CatalogPagination` is reused on
admin pages and builds `?page=N` correctly, so normal use is fine — but any
crawler, a stale bookmark, or a copy-pasted link with a mangled param hits it.

### Impacto

- Segurança: baixo (admin-only, no data exposure)
- Correção: médio (a trivially-reachable 500)
- Performance: nenhum
- Manutenção: baixo
- UX: médio (admin sees a generic error with no way to recover except editing
  the URL)

### Severidade

**P2**

### Recomendação

Extract the storefront's parser into a shared helper and use it everywhere:

```ts
// apps/web/lib/search-params.ts
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
```

Also harden the query layer as defence in depth — in each `list*Admin`:

```ts
const page = Number.isInteger(params.page) && params.page! > 0 ? params.page! : 1;
const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isInteger(params.pageSize) ? params.pageSize! : DEFAULT_PAGE_SIZE));
```

Note `listProductsAdmin`, `listOrdersAdmin`, `listUsersAdmin` and
`listAuditLogAdmin` also accept an **unclamped `pageSize`** from their
callers. No caller passes a hostile value today, but the storefront
`listProducts` clamps to `MAX_PAGE_SIZE = 100` and the admin ones don't —
make them consistent.

### Dependências

None.

### Testes necessários

- Unit: `parsePage("abc" | "" | "-1" | "1.5" | "1e400" | undefined)` → `1`;
  `parsePage("3")` → `3`.
- Integration: `listProductsAdmin(db, { page: NaN as never })` returns page 1
  rather than throwing.
- E2E: `/admin/products?page=abc` returns 200 and renders page 1.

---

## BE-02 Zod `.parse()` throws inside Server Actions, contradicting the documented error contract

**Confidence: Confirmed**

### Localização

Every action. Representative: `apps/web/lib/actions/cart.ts:29, 53, 65`,
`checkout.ts:34`, `admin-products.ts:24, 37-38, 54`, `mock-checkout.ts:23, 40`.

### Problema

`plan.md` §20 states the contract explicitly:

> *"Zod validation at every boundary; validation failures are typed, expected
> results (not thrown exceptions) so forms can render field-level errors."*

Every action uses `schema.parse(input)`, which **throws** a `ZodError`. None
uses `safeParse`. The consequence differs by caller:

- Where the client uses the *same* schema via `zodResolver` (checkout,
  product form, banner form, address form), client-side validation normally
  prevents an invalid payload — so the throw is unreachable in the happy path.
  This is why it has never surfaced.
- Where the client builds the payload itself, it is reachable. Example:
  `ProductVariantPanel` (`components/product-variant-panel.tsx:47`) calls
  `addToCartAction({ variantId: selectedVariantId, quantity })`. `quantity` is
  capped at `selectedStock` in the UI. If a product's stock is > 99 the UI
  will happily let the user reach 100+, and `addToCartSchema`'s
  `.max(99)` (`actions/cart.ts:23`) throws — no message, silent failure.
  The seed's max stock is 40, so this is currently unreachable; an admin
  restocking to 120 makes it live.
- Anyone calling an action directly (another client, a script, a malformed
  request) gets an unhandled server exception rather than a clean rejection.

The related consequence is that a thrown error inside a Server Action produces
a **generic digest-only error** on the client (production hides the message),
so there is nothing for the UI to render even if it caught it.

### Impacto

- Segurança: baixo (the throw is safe — it does not leak, and Next scrubs the
  message in production)
- Correção: médio
- Manutenção: médio (documented contract not honoured)
- UX: médio (silent failures for any payload the client didn't pre-validate)

### Severidade

**P2**

### Recomendação

Introduce one helper and use it at every action boundary:

```ts
// apps/web/lib/actions/validate.ts
export type ValidationFailure = { ok: false; reason: "invalid_input"; fieldErrors: Record<string, string[]> };
export function validate<T extends z.ZodTypeAny>(schema: T, input: unknown):
  { ok: true; data: z.infer<T> } | ValidationFailure {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, reason: "invalid_input", fieldErrors: z.flattenError(parsed.error).fieldErrors };
}
```
(Zod 4 exposes `z.flattenError`; confirm the exact API against the installed
version — `zod@^4.4.3` — before writing this.)

Then widen each action's result union with `ValidationFailure` and render
`fieldErrors` in the forms. Do this in the same pass as **FE-01** so the
client actually consumes the new branch.

Also raise `addToCartSchema.quantity.max` from 99 to a value derived from
stock, or clamp client-side to `Math.min(stock, 99)` so the two can't diverge.

### Dependências

Pairs with **FE-01** (client-side error handling) and **VAL-01** (the schemas
being edited anyway).

### Testes necessários

- Unit per action: an invalid payload returns `{ok:false, reason:"invalid_input"}`
  rather than throwing, and no DB row is written.
- Component test: an action returning `invalid_input` renders field-level
  errors.

---

## BE-03 SKU uniqueness violations are untyped and surface as a misleading error

**Confidence: Confirmed** · **Severidade: P2**

### Localização

- `packages/db/src/queries/admin-variants.ts:16-38` (`createVariantAdmin`),
  `:40-64` (`updateVariantAdmin`) — neither catches `23505`
- `packages/db/src/schema/product.ts:92` — `sku: text("sku").notNull().unique()`
- `apps/web/lib/actions/admin-variants.ts:18-24, 28-34` — no typed result
- `apps/web/components/admin/variant-manager.tsx:76-92` — a blanket
  `catch { setError("Could not add variant — check the SKU is unique.") }`

### Problema

Every other admin query module catches its unique violation and returns a
typed reason (`admin-products.ts:193` → `slug_taken`, `admin-categories.ts:76`
→ `slug_taken`). `admin-variants.ts` does not. A duplicate SKU therefore
throws a raw `DrizzleQueryError` out of the action.

`VariantManager` masks this with a `try/catch` that reports *"check the SKU is
unique"* for **any** failure — including a Zod rejection (e.g. a negative
`priceOverrideCents`, which `variantSchema.min(0)` rejects), a network error,
or a DB outage. The admin is told to fix the SKU when the SKU is fine.

### Impacto

Correção: médio · Manutenção: médio · UX: médio · Segurança: nenhum

### Recomendação

Mirror the products/categories pattern exactly:

```ts
export type SaveVariantResult = { ok: true; id: string } | { ok: false; reason: "sku_taken" | "not_found" };
// wrap the transaction in try/catch, and:
if (isUniqueViolation(err, "product_variant_sku_unique")) return { ok: false, reason: "sku_taken" };
```
Confirm the real constraint name first:
```bash
psql "$DATABASE_URL" -c "\d product_variant"
```
(drizzle names it from the table+column; `admin-products.ts` uses
`product_slug_unique`, so `product_variant_sku_unique` is the expected form —
**verify, don't assume**, since a wrong name makes `isUniqueViolation` return
false and silently rethrow, which is exactly the class of bug `tasks.md` 7.10
already found once.)

Then replace `VariantManager`'s blanket catch with a switch on the typed
reason plus a generic fallback for genuine exceptions.

### Testes necessários

- Integration: creating two variants with the same SKU returns
  `{ok:false, reason:"sku_taken"}`, and the first variant is untouched.
- Integration: `updateVariantAdmin` renaming a SKU onto an existing one
  returns the same.
- Component: the form renders "SKU already in use" for `sku_taken` and a
  different message for an unexpected error.

---

## BE-04 A product's last variant can be deleted, leaving a product that cannot be displayed or bought

**Confidence: Confirmed** · **Severidade: P2**

### Localização

- `packages/db/src/queries/admin-variants.ts:69-89` (`deleteVariantAdmin`)
- `packages/db/src/schema/product.ts:79-83` — the invariant, stated only in a
  comment: *"Every product gets at least one variant row at creation time …
  so stock/price logic never branches on 'does this product have variants'"*
- `apps/web/components/product-variant-panel.tsx:32-33` — `if (!selected) return null`
- `packages/db/src/queries/products.ts:75-80` — `inStockSubquery`

### Problema

`architecture.md` §3 and the schema comment both assert *"Every product has at
least an implicit 'default' variant row so stock logic never branches."*
`createProductAdmin` upholds it (`admin-products.ts:177-182` inserts a
`Default` variant). Nothing enforces it afterwards.

`deleteVariantAdmin` only refuses when an `order_item` FK blocks the delete
(`has_orders`). Deleting the sole variant of a never-sold product succeeds.
Afterwards:

- `getProductBySlug` returns `variants: []`.
- `ProductVariantPanel` returns `null` → the product page renders **no price,
  no stock badge, no Add to Cart** — just a title, breadcrumb and images.
- `inStockSubquery` is false → the catalog card shows "Out of stock".
- There is no admin warning and no way to notice except opening the page.

`ProductForm` has no variant management on the *create* screen, so an admin
who deletes "Default" intending to replace it with sized variants leaves the
product in this state between the two clicks.

### Cenário que reproduz o problema

1. `/admin/products/new` → create "Oaken Shield" (status: active). A `Default`
   variant is auto-created with stock 0.
2. On the edit page, Variants section → **Delete** on `Default`. It succeeds
   (never ordered).
3. Visit `/product/oaken-shield` — a product page with no price and no buy
   button, and no error anywhere.

### Impacto

- Correção: alto (an unbuyable, silently broken product page)
- Manutenção: médio (a documented invariant with no enforcement)
- UX: alto
- Segurança/Performance: nenhum

### Severidade

**P2**

### Recomendação

Enforce at three levels:

1. **Query guard (required).** In `deleteVariantAdmin`, inside the transaction,
   count remaining variants for the product; if this delete would take it to
   zero return `{ ok:false, reason:"last_variant" }`. Surface a message in
   `VariantManager`.
2. **UI (required).** Disable/hide the Delete button when
   `variants.length === 1`, with a tooltip explaining why.
3. **Defensive render (recommended).** Make `ProductVariantPanel` render an
   explicit "Currently unavailable" state instead of `null`, so a product that
   *does* reach zero variants (bad data, direct SQL) degrades visibly rather
   than silently.

A DB-level constraint is not practical here (it needs a deferred trigger); the
query guard plus a test is the right level. See DB-05.

### Dependências

Touches the same file as BE-03; do them together.

### Testes necessários

- Integration: a product with one variant → `deleteVariantAdmin` returns
  `last_variant` and the row still exists.
- Integration: a product with two variants → deleting one succeeds; deleting
  the second is refused.
- E2E: the Delete button is disabled on a single-variant product.

---

## BE-05 `updateAddress` can leave a user with zero default addresses

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`packages/db/src/queries/addresses.ts:42-67`, specifically line 55:
```ts
const isDefault = input.isDefault === true;
```
Compare `createAddress` (line 31), which *does* uphold the invariant:
```ts
const isDefault = input.isDefault === true || existing.length === 0;
```

### Problema

The documented rule (`tasks.md` 6.2) is: *"first address is always the default
regardless of the input flag; creating/editing a new default demotes the old
one; deleting the default promotes the next-most-recent remaining address."*
Two of the three are implemented. Editing is not.

`updateAddress` sets `isDefault` to exactly what the form submitted. If a user
has **one** address (necessarily the default) and edits it — say to fix a
typo in the postcode — without ticking "Default", the row is written with
`is_default = false`. The user now has one address and no default.

`deleteAddress`'s promotion logic doesn't help (nothing was deleted), and
there is no other code path that re-establishes a default. The state persists
until the user manually ticks the box or adds a second address.

Today the practical impact is limited because **checkout does not use saved
addresses at all** (`tasks.md` 6.2 records this as a known follow-up:
*"Checkout still uses its own inline address form and doesn't yet offer 'pick
a saved address'"*). The moment that is built, "no default address" becomes a
user-visible defect on the highest-value screen.

### Impacto

- Correção: médio (an invariant the rest of the code will assume)
- UX: médio (latent — becomes visible when checkout reads saved addresses)
- Others: nenhum

### Severidade

**P2**

### Recomendação

In `updateAddress`, inside the existing transaction:

```ts
const [{ count: total }] = await tx.select({ count: count() }).from(address).where(eq(address.userId, userId));
const isDefault = input.isDefault === true || total === 1;
```
and additionally: if the row being edited *was* the default and the update
would clear it, either refuse the change or promote another address in the
same transaction — never leave the set without a default.

Back it with **DB-04** (a partial unique index guaranteeing at most one
default) so the two rules together make "exactly one default" enforceable.

### Dependências

Pairs with DB-04. Should land before any "pick a saved address at checkout"
feature.

### Testes necessários

- Integration: a user with one default address, updated with
  `isDefault: false` → the row remains default.
- Integration: a user with two addresses, editing the non-default with
  `isDefault: true` → exactly one default afterwards, and it is the edited one.
- Integration: after every address mutation, assert
  `count(where is_default) === (count(*) > 0 ? 1 : 0)`.

---

## SEC-12 The webhook never verifies the paid amount against the order total

**Confidence: Confirmed** · **Severidade: P2** (fully detailed in
[`06-security.md`](06-security.md); summarised here because it is a backend
contract gap)

`apps/web/app/api/webhooks/stripe/route.ts:40-49` receives
`event.amountCents` (parsed at `packages/payments/src/providers/stripe.ts:87`)
and **discards it**. `fulfillPaidOrder` is called with only
`{eventId, provider, orderId, providerRef}`; it never compares the captured
amount to `order.total_cents`, and never updates `payment.amount_cents` from
the actual capture. Signature verification makes forgery infeasible, so this
is defence-in-depth rather than an open hole — but it is the standard check
for exactly the class of bug where a Checkout Session is created for one
amount and completed for another (partial capture, currency mismatch, a
session mutated via the Stripe API).

**Recomendação:** pass `amountCents` and `currency` into `fulfillPaidOrder`;
if they don't match the order, do **not** mark it paid — record an
`amount_mismatch` outcome, log at `error` level, and leave the order for
manual review. Add `payment.amount_cents` reconciliation on the success path.

---

## Remaining backend findings (P3)

| ID | Finding | Localização | Impacto & Recomendação |
|---|---|---|---|
| **BE-06** | `updateVariantAction` / `updateVariantAdmin` are fully implemented, exported, and **called by nothing** — `VariantManager` offers only create, delete and stock-adjust. Dead code that reads as a feature, and the entry point for VAL-02's latent bug. | `lib/actions/admin-variants.ts:28`, `queries/admin-variants.ts:40`, `components/admin/variant-manager.tsx` | Manutenção: médio. Either build the inline edit row (small — the table already exists) or delete both functions. Building it is the better call: without it an admin cannot fix a typo'd variant name or SKU. |
| **BE-07** | `getShippingMethod` throws on an unknown id. Its only caller passes a value already validated by `z.enum(SHIPPING_METHOD_IDS)`, so it's unreachable — but the throw is inside `checkoutAction` and would be an unhandled 500 rather than a typed result. | `lib/shipping.ts:10-14`, `lib/actions/checkout.ts:49` | Correção: baixo. Return `undefined` and let the caller produce a typed `invalid_shipping_method` result, consistent with the rest of `checkoutAction`. |
| **BE-08** | The analytics route returns HTTP 200 with `{ok:true}` even when the DB insert threw; the client cannot distinguish success from a swallowed failure. Deliberate ("best-effort"), but combined with SEC-05 (no rate limit) there is no signal at all that the endpoint is failing. | `app/api/analytics/track/route.ts:28-39` | Manutenção: baixo. Keep the 200 (correct for a beacon) but add a counter/metric on the failure path, and make the logger line include enough context to alert on. |
| **BE-10** | `createOrder` hardcodes `currency: "USD"` and `taxCents: 0` while the schema models both per-order and per-product (`product.currency`, `order.currency`, `order.tax_cents`). `formatPriceCents` also hardcodes the `en-US` locale. | `queries/orders.ts:116, 114`; `lib/format.ts:2` | Correção: baixo, Manutenção: médio. **Question** — `spec.md` §6 lists multi-currency as an explicit non-goal ("currency is modeled but not converted"), so hardcoding is consistent with the spec. Recommendation: read the currency from the cart/product rather than the literal, so the model and the code agree, and add a `CHECK` that all lines in an order share a currency. Tax is genuinely out of scope; leave `taxCents` at 0 but say so in a comment. |
| **BE-11** | `listProductsAdmin`, `listOrdersAdmin`, `listUsersAdmin`, `listAuditLogAdmin` accept an unclamped `pageSize` from callers, unlike the storefront `listProducts` which clamps to 100. | `queries/admin-products.ts:58`, `admin-orders.ts:37`, `admin-users.ts:28`, `admin-audit.ts:40` | Performance: baixo, Segurança: baixo. Fold into BE-01's fix — clamp `pageSize` in the same helper. |
