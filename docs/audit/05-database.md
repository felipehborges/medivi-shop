# 05 — Database

Findings: `DB-01` … `DB-10`.

---

## 1. Schema inventory

22 tables across 10 schema files, 6 migrations (`0000`–`0005`), all
checked in with matching `meta/*_snapshot.json`. Schema is owned entirely by
`packages/db`; no manual DB edits anywhere in the history.

| Table | PK | Notable constraints |
|---|---|---|
| `user` | `text id` | `email` unique, `role` enum NOT NULL default `customer` |
| `session` | `text id` | `token` unique, FK→user cascade, idx on `user_id` |
| `account` | `text id` | FK→user cascade, idx on `user_id` |
| `verification` | `text id` | idx on `identifier` |
| `category` | `uuid` | `slug` unique, self-FK `parent_id` **restrict** |
| `product` | `uuid` | `slug` unique, FK→category **restrict**, generated `tsvector`, 4 indexes |
| `product_image` | `uuid` | FK→product cascade, idx on `product_id` |
| `product_variant` | `uuid` | `sku` unique, FK→product cascade, **CHECK `stock >= 0`**, idx on `product_id` |
| `address` | `uuid` | FK→user cascade — **no index** |
| `cart` | `uuid` | `user_id` unique, `guest_token` unique, **CHECK XOR owner** |
| `cart_item` | `uuid` | FK→cart cascade, FK→variant cascade, **UNIQUE (cart_id, variant_id)**, **CHECK `quantity > 0`** |
| `order` | `uuid` | `order_number` unique, FK→user set null, FK→cart set null, **CHECK `user_id IS NOT NULL OR guest_email IS NOT NULL`** — no other index |
| `order_item` | `uuid` | FK→order cascade, FK→product **restrict**, FK→variant **restrict**, idx on `order_id` |
| `payment` | `uuid` | FK→order cascade — **no index, no unique** |
| `processed_webhook_event` | `text event_id` | the idempotency ledger |
| `wishlist` | `uuid` | `user_id` unique, FK→user cascade |
| `wishlist_item` | `uuid` | FK→wishlist cascade, FK→product cascade, **UNIQUE (wishlist_id, product_id)** |
| `banner` | `uuid` | — no index |
| `feature_flag` | `text key` | unused by any query |
| `inventory_log` | `uuid` | FK→variant cascade — **no index** |
| `audit_log` | `uuid` | FK→user set null — **no index** |
| `analytics_event` | `uuid` | FK→user set null — **no index** |

### What's genuinely good

- **`cart_owner_xor`** — `(user_id IS NULL) != (guest_token IS NULL)` makes
  "a cart is either guest or user, never both, never neither" a database
  invariant, not a convention. Tested in `constraints.test.ts`.
- **`product_variant_stock_non_negative`** — the last line of defence behind
  the guarded decrement, and `adjustStockAdmin` deliberately *catches* the
  check violation rather than duplicating the guard (`admin-variants.ts:127`).
- **`order_has_owner`** — an order always has a customer identity.
- **`cart_item_cart_variant_idx` UNIQUE** — makes "one row per variant per
  cart" structural, which is why `addCartItem`'s increment logic is safe.
- **`restrict` on `order_item → product/variant`** — historical orders can
  never be orphaned by a delete. This is why product delete is a soft delete,
  and it's the right call.
- **Generated `tsvector` column with weighting** (`setweight(... 'A')` on name,
  `'B'` on description) plus a GIN index — genuinely well done.
- **Zero raw string-interpolated SQL.** Every `sql` template interpolates
  drizzle column objects or bound parameters. The two historical bugs
  documented in `tasks.md` (unqualified column references in hand-written
  subqueries) were fixed by moving to the query builder — the fix held; I
  re-checked `products.ts:75-92` and `cart.ts:39-46`.

---

## DB-01 Missing indexes on every hot order / payment / analytics / audit access path

**Confidence: Confirmed**

### Localização

Migrations `0000`–`0005` create exactly 12 indexes (verified by grepping
`CREATE INDEX` across `packages/db/migrations/*.sql`). The tables below have
none of the ones their queries need.

### Problema

| Missing index | Queried by | Current plan |
|---|---|---|
| `order (user_id)` | `listOrdersForUser` (`orders.ts:281`) — the account order-history page | Seq scan of `order` |
| `order (created_at DESC)` | `listOrdersForUser:283`, `listOrdersAdmin:57` | Seq scan + full sort |
| `order (status)` | `listOrdersAdmin:38`, `revenueOverTime:23`, `topProductsByRevenue:41` | Seq scan |
| `order (cart_id)` | **FK with `ON DELETE SET NULL`** | Every `DELETE FROM cart` (guest-cart merge, user delete cascade) scans all of `order` |
| `payment (order_id)` | `getOrderById:217`, `getLatestPaymentForOrder:407`, `fulfillPaidOrder:349,356`, `recordPaymentFailure:389`, `markOrderRefunded:424` | Seq scan of `payment` **on every order read and every fulfilment** |
| `address (user_id)` | `listAddressesForUser:22`, `createAddress:30,33`, `updateAddress:52,57`, `deleteAddress:81` — and the FK cascade | Seq scan |
| `analytics_event (created_at)`, `(type, created_at)`, `(session_id)` | `conversionFunnel:90-97` | Seq scan + `count(distinct)` over the whole table |
| `audit_log (created_at DESC)`, `(actor_id)`, `(entity_type)` | `listAuditLogAdmin:47,62,64` and `listAuditEntityTypes:72` | Seq scan + sort, twice per page load |
| `inventory_log (variant_id)` | FK; no read query yet, but the cascade needs it | Scan on variant delete |
| `banner (placement, is_active)` | `listActiveBanners:35` — runs on **every homepage render** | Seq scan (tiny table; low priority) |
| `product_variant (stock)` | `lowStockAlerts:67` | Seq scan (moderate table) |

The two that matter most:

- **`payment (order_id)`** — `getOrderById` is called by the confirmation
  page, the account order-detail page, the admin order-detail page, the mock
  checkout page and `sendOrderConfirmationEmail`. Every one of those does a
  sequential scan of `payment`, which grows 1:1 with orders forever.
- **`order (cart_id)`** — an *unindexed* FK with a referential action. Postgres
  must scan the referencing table on every delete of a referenced row. Guest
  carts are deleted on every single sign-in that has a guest cart
  (`cart.ts:277`). So every login scans the entire `order` table.

### Por que isso é um problema

`spec.md` §11 states: *"Database queries for catalog listing are covered by
indexes … no N+1 query patterns in listing/detail endpoints (verified by
query-count assertions in tests, not just eyeballing)."* The **catalog** side
of that is genuinely true and tested (`products.test.ts` has a real
query-count assertion). The order/payment/analytics side has neither indexes
nor assertions.

With 36 seeded products and a handful of orders, none of this is measurable —
which is exactly why it wasn't caught. It degrades linearly and silently.

### Cenário que reproduz o problema

```sql
-- Against a database with ~50k orders / ~50k payments:
EXPLAIN ANALYZE SELECT status FROM payment WHERE order_id = '<uuid>' ORDER BY created_at DESC LIMIT 1;
-- Seq Scan on payment  (cost=… rows=1 width=…) (actual time=…)
EXPLAIN ANALYZE DELETE FROM cart WHERE id = '<uuid>';
--   -> Seq Scan on "order"  (referential integrity check)
```

To reproduce locally without 50k rows, run the analytics beacon in a loop for
a minute (it's unauthenticated and unrate-limited — SEC-05), then load
`/admin/analytics` and watch `conversionFunnel` scan.

### Impacto

- Segurança: nenhum (though it amplifies SEC-05's DoS surface)
- Correção: nenhum
- Performance: **alto** (linear degradation on the account, admin and
  fulfilment paths; a full-table scan on every login)
- Manutenção: médio
- UX: médio (slow order history / admin as data grows)

### Severidade

**P1**

### Recomendação

One migration adding the following. Add them to the drizzle schema files so
`drizzle-kit generate` produces the migration — do **not** hand-write SQL:

```ts
// schema/order.ts
(table) => [
  check("order_has_owner", …),                                    // existing
  index("order_user_idx").on(table.userId),
  index("order_status_idx").on(table.status),
  index("order_created_at_idx").on(table.createdAt.desc()),
  index("order_cart_idx").on(table.cartId),
]

// schema/payment.ts  → convert to the (table) => [...] form
index("payment_order_idx").on(table.orderId, table.createdAt.desc())

// schema/address.ts
index("address_user_idx").on(table.userId)

// schema/ops.ts
index("inventory_log_variant_idx").on(table.variantId)
index("audit_log_created_at_idx").on(table.createdAt.desc())
index("audit_log_actor_idx").on(table.actorId)
index("audit_log_entity_idx").on(table.entityType, table.entityId)
index("analytics_event_type_created_idx").on(table.type, table.createdAt)
index("analytics_event_session_idx").on(table.sessionId)

// schema/content.ts
index("banner_placement_active_idx").on(table.placement, table.isActive)

// schema/product.ts
index("product_variant_stock_idx").on(table.stock)   // supports lowStockAlerts
```

Notes:
- `order (user_id, created_at DESC)` as a composite would serve
  `listOrdersForUser` better than two separate indexes — prefer the composite
  and drop the standalone `user_id` one.
- Same for `audit_log (entity_type, created_at DESC)`.
- On a real deployment these must be created `CONCURRENTLY`; drizzle-kit does
  not emit that. Note it in `runbook.md` §Migrations — for a table with real
  volume, hand-edit the generated SQL to add `CONCURRENTLY` and remove the
  surrounding transaction, or accept the lock during a maintenance window.

### Dependências

**ECM-07** wants a partial unique index on `order (cart_id) WHERE status =
'pending'` — if you do both, that index also serves the FK, so add it in the
same migration and skip the plain `order_cart_idx`.

### Testes necessários

- Extend the existing query-count/plan pattern from `products.test.ts` to
  orders: assert `getOrderById` issues a bounded number of queries and that
  `EXPLAIN` for the payment lookup uses an index scan. A pragmatic version:
  a test that runs `EXPLAIN (FORMAT JSON)` and asserts the plan node type is
  not `Seq Scan` for the four hot queries above.
- Seed-scale performance test is not necessary; the plan assertion is enough.

---

## DB-02 Every timestamp column is `timestamp` (no time zone) and receives JS `Date` values

**Confidence: Confirmed**

### Localização

Every schema file uses `timestamp("...")` with no `{ withTimezone: true }`:
`auth.ts:30,31,48,51,72,76,89,92`, `category.ts:18,19`,
`product.ts:48,49,74,96,97`, `address.ts:18,19`, `cart.ts:30,31,53,54`,
`order.ts:62,63,96`, `payment.ts:35,36,47`, `wishlist.ts:12,25`,
`content.ts:19,20,22,23,30`, `ops.ts:22,33,54`.

Consumed by, among others:
- `queries/banners.ts:17-23` — `lte(banner.startsAt, new Date())`
- `queries/admin-analytics.ts:12-14` — `since` computed in JS, and
  `to_char(order.created_at, 'YYYY-MM-DD')` for day bucketing
- `queries/admin-analytics.ts:87-97` — funnel window
- `lib/actions/admin-banners.ts:20-21` — `new Date(parsed.startsAt)` from a
  `datetime-local` string
- `components/admin/banner-form.tsx:13-16` — the reverse conversion, applying
  `getTimezoneOffset()`

### Problema

`timestamp without time zone` stores a wall-clock value with no zone. The
`postgres` driver serialises a JS `Date` into that column using the **Node
process's local time zone**, and deserialises it back the same way. So the
meaning of every stored instant depends on `TZ` in the environment that wrote
it and the one that reads it.

Concrete places this bites:

1. **Banner scheduling.** An admin in `America/Sao_Paulo` sets a banner to
   start at `2026-08-10T09:00`. `BannerForm` converts to a local
   `datetime-local` string; `toBannerInput` does `new Date("2026-08-10T09:00")`
   (parsed as *browser* local, then serialised as *server* local). If the
   server runs UTC (as every container here does — neither `Dockerfile` nor
   either compose file sets `TZ`), the banner goes live three hours off.
2. **Revenue bucketing.** `to_char(order.created_at, 'YYYY-MM-DD')` groups by
   the stored wall-clock day. `revenueOverTime`'s `since` is a JS `Date`
   serialised in server-local time. Move the app between regions (Vercel
   region change, a self-host box with a local `TZ`) and yesterday's revenue
   silently shifts across the day boundary.
3. **Mixed writers.** `defaultNow()` uses the **database's** `TimeZone`
   setting; `updatedAt: new Date()` uses the **application's**. If they ever
   differ, `created_at` and `updated_at` on the same row are in different zones
   with no way to tell.
4. **Rendering.** `toLocaleString()` in Server Components (FE-11) formats
   these zone-less values using the server locale, compounding the ambiguity.

Today everything is UTC everywhere (Docker default, GitHub Actions default,
Vercel default), so nothing is visibly wrong. The failure is
environment-dependent and will show up as "the analytics numbers moved" long
after the change that caused it.

### Cenário que reproduz o problema

```bash
# Same code, same database, different container TZ:
docker run -e TZ=America/Sao_Paulo … medivi-shop
```
Place an order. Read `order.created_at` from `psql`. It is stored three hours
behind the actual UTC instant, and `revenueOverTime` buckets it into the wrong
day for any order placed between 21:00 and 24:00 UTC.

### Impacto

- Segurança: nenhum
- Correção: médio (silently wrong analytics and scheduling under a TZ change)
- Performance: nenhum
- Manutenção: alto (the bug class is invisible until it isn't)
- UX: baixo

### Severidade

**P2**

### Recomendação

1. **Convert every timestamp column to `timestamptz`.** In drizzle:
   `timestamp("created_at", { withTimezone: true })`. Generate a migration;
   the `ALTER TABLE … TYPE timestamptz` conversion interprets existing values
   using the session `TimeZone`, so run it with `SET TIME ZONE 'UTC'` if the
   data was written by a UTC process (it was).
2. **Pin `TZ=UTC`** in the `Dockerfile` runner stage and in
   `docker-compose.prod.yml`, and note it in `runbook.md`, so there is a
   documented invariant even after (1).
3. **Bucket analytics explicitly.** Replace
   `to_char(order.created_at, 'YYYY-MM-DD')` with
   `to_char(order.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')` so the
   reporting day is defined rather than inherited.
4. **Fix the banner round-trip.** With `timestamptz`, drop the manual
   `getTimezoneOffset()` arithmetic in `banner-form.tsx:13-16` and treat the
   `datetime-local` input as the admin's local time explicitly, converting
   once, in one place.

If (1) is judged too invasive, the minimum acceptable action is (2) + (3) +
a comment on the schema saying "all timestamps are UTC by convention; the
process must run with TZ=UTC".

### Dependências

Touches every table. Do it in **one** migration, early, before more rows
exist. Blocks nothing, but FE-11 (date rendering) should be done after.

### Testes necessários

- Integration run under `TZ=America/Sao_Paulo`: insert a row, read it back,
  assert the instant round-trips exactly.
- Integration: `listActiveBanners` with `startsAt` one minute in the future
  returns nothing, and one minute in the past returns the banner — under two
  different `TZ` settings.
- Integration: `revenueOverTime` buckets an order created at `23:30 UTC` into
  that UTC day regardless of process `TZ`.

---

## DB-06 Payment status updates target every payment row for an order

**Confidence: Confirmed**

### Localização

- `packages/db/src/queries/orders.ts:346-349` (oversold → all failed)
- `packages/db/src/queries/orders.ts:353-356` (success → all succeeded)
- `packages/db/src/queries/orders.ts:386-389` (`recordPaymentFailure`)
- `packages/db/src/queries/orders.ts:424` (`markOrderRefunded`)
- `packages/db/src/schema/payment.ts:19-23` — the comment that makes this a
  bug rather than a simplification

### Problema

The schema explicitly documents `payment` as one-to-**many**:

> *"One row per order today; not unique-constrained on `orderId` so a future
> partial-capture/refund-history model can add more rows without a schema
> change."*

Every write, however, is `WHERE payment.order_id = $orderId` with no further
qualifier — so each one updates **all** payment rows for that order.

The 1:1 assumption is already violated by the code itself: **ECM-07** allows a
cart to produce several orders, but more directly, `checkoutAction` creates one
payment row per attempt (`checkout.ts:70-75`). If a customer retries a
checkout for the *same* order (they can't today, but the retry path
`spec.md` §7 describes — *"user can retry from the confirmation/cart page"* —
is exactly that feature), a second `payment` row appears. From that moment:

- one webhook marks **both** payments `succeeded`,
- `getLatestPaymentForOrder` (which correctly does `ORDER BY created_at DESC
  LIMIT 1`) returns the newest, but `refundOrderAction` then refunds only that
  one while `markOrderRefunded` marks *both* `refunded`,
- the ledger claims two successful payments and two refunds for one order.

There is also no `UNIQUE` on `payment(provider, provider_ref)`, so the same
Stripe payment intent can be recorded twice.

### Por que isso é um problema

The idempotency ledger (`processed_webhook_event`) protects against
*duplicate events*. It does not protect against *multiple payment rows*. The
combination of "1:many by design" and "every write is unqualified" means the
payment ledger is only correct while the 1:1 accident holds — and several
planned features (retry, partial capture, refund history) break it.

For a system whose stated hard rule is *"Payment status only ever changes via
a verified webhook"*, the payment table is the ledger of record, and it can be
corrupted by an ordinary feature addition.

### Cenário que reproduz o problema

```sql
-- Simulate a retry (the feature spec.md §7 describes):
INSERT INTO payment (order_id, provider, provider_ref, amount_cents, status)
VALUES ('<order>', 'mock', 'mock_retry_2', 5400, 'requires_payment');
```
Approve the payment. Both rows become `succeeded`. Refund the order: both
become `refunded`, but `provider.refund` was called once. The store's own
records now claim two refunds were issued.

### Impacto

- Segurança: nenhum
- Correção: **alto** (financial ledger corruption once a second row exists)
- Performance: baixo
- Manutenção: alto
- UX: baixo

### Severidade

**P0** — not because it is exploitable today (it needs a second payment row,
which no current code path creates for the same order), but because it is a
*financial ledger* correctness defect that any of three planned features
silently activates, and because the fix is small and mechanical now versus
expensive later.

### Recomendação

1. **Target payments by id.** Resolve the specific payment first, then update
   it:
   ```ts
   const [pay] = await tx.select({ id: payment.id })
     .from(payment)
     .where(and(eq(payment.orderId, event.orderId), eq(payment.status, "requires_payment")))
     .orderBy(desc(payment.createdAt)).limit(1);
   if (!pay) return { outcome: "no_open_payment" };
   await tx.update(payment).set({ status: "succeeded", … }).where(eq(payment.id, pay.id));
   ```
   Apply the same shape in all four call sites.
2. **Add `UNIQUE (provider, provider_ref)`** on `payment` so the same provider
   reference can never be recorded twice. (Check the existing data first — the
   mock provider uses `mock_<orderId>`, which is already unique per order.)
3. **Add a partial unique index** enforcing at most one *open* payment per
   order: `UNIQUE (order_id) WHERE status IN ('requires_payment','processing')`.
   This makes the retry feature safe by construction.
4. **Model refunds separately.** If refund history matters, a `refund` table
   referencing `payment` is cleaner than overloading `payment.status`. Note it
   as a follow-up in `architecture.md` §3 either way.

### Dependências

- Do with **ECM-04** (same two statements) and before **ECM-03** (whose fix
  needs to identify a specific payment to refund).

### Testes necessários

- Integration: an order with two payment rows (one `requires_payment`, one
  `failed`) → `fulfillPaidOrder` marks exactly the open one `succeeded`.
- Integration: inserting a second `requires_payment` row for the same order is
  rejected by the partial unique index.
- Integration: inserting a duplicate `(provider, provider_ref)` is rejected.
- Integration: `markOrderRefunded` updates exactly the payment that was
  refunded.

---

## Remaining database findings

### DB-03 The Postgres client uses library defaults, unsuited to the documented Neon/Vercel target

**Confidence: Likely** · **Severidade: P2**

**Localização:** `packages/db/src/client.ts:12` — `const client = postgres(connectionString);`

**Problema:** no options are passed. `postgres.js` defaults to a pool of
**10** connections per process, with prepared statements enabled. The
documented primary deployment (`architecture.md` §10A, `runbook.md`) is Vercel
+ Neon:

- Each serverless instance opens up to 10 connections. Neon's free/starter
  tiers cap total connections well below what a handful of concurrent
  instances would demand; the pooled (pgBouncer) connection string is the
  documented remedy, and `runbook.md` step 2 does say *"Copy its **pooled**
  connection string"* — good.
- But pgBouncer in **transaction** pooling mode is incompatible with prepared
  statements. `postgres.js` uses them by default. This is the classic
  "prepared statement 'sN' already exists" failure, and it appears under
  concurrency, not on the first request.
- There is no `idle_timeout`, so idle serverless instances hold connections
  until Neon reaps them.

The project has already hit a connection-exhaustion problem in dev — recorded
in `tasks.md` Phase 3 validation (*"sorry, too many clients already"*, traced
to Turbopack HMR re-creating the module-level pool). That was diagnosed as a
dev-server artifact, and the suggested fix (*"a global-scoped client keyed off
`globalThis` in dev"*) was never applied.

**Why "Likely":** whether prepared statements break depends on Neon's pooler
mode, which I can't observe from here. Verify with:
```bash
DATABASE_URL="<neon pooled url>" node -e "…run two concurrent queries…"
```

**Recomendação:**
```ts
const client = postgres(connectionString, {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,               // required for transaction-mode poolers
});
```
plus the `globalThis` guard for dev HMR:
```ts
const globalForDb = globalThis as unknown as { __mediviClient?: ReturnType<typeof postgres> };
const client = globalForDb.__mediviClient ?? postgres(connectionString, {...});
if (process.env.NODE_ENV !== "production") globalForDb.__mediviClient = client;
```
Document `DATABASE_POOL_MAX` in `.env.example` and `runbook.md`.

**Testes necessários:** run the existing suite with `prepare: false` to confirm
no regression; a manual concurrency check against a pooled Neon URL.

---

### DB-04 No database guarantee of "exactly one default address per user"

**Confidence: Confirmed** · **Severidade: P3**

**Localização:** `packages/db/src/schema/address.ts:17`;
rules enforced only in `queries/addresses.ts:28-88`.

**Problema:** `is_default` is a plain boolean. The "one default" rule lives in
three separate application functions, one of which is already broken (BE-05).
Nothing prevents two defaults, or zero.

**Recomendação:** add
```sql
CREATE UNIQUE INDEX address_one_default_per_user
  ON address (user_id) WHERE is_default;
```
Drizzle: `uniqueIndex("address_one_default_per_user").on(table.userId).where(sql`${table.isDefault}`)`.
Note the existing "demote all, then set" ordering in `createAddress`/
`updateAddress` is already compatible with this index **within a
transaction** — verify the demote runs before the promote in every path
(it does today). Zero defaults still needs the application fix (BE-05).

**Testes necessários:** integration — attempting to set a second default
outside the transaction's demote-then-promote ordering raises `23505`.

---

### DB-05 No enforcement that a product always has at least one variant

**Confidence: Confirmed** · **Severidade: P3**

**Localização:** `packages/db/src/schema/product.ts:79-83` (the invariant, in a
comment), `queries/admin-variants.ts:69-89` (`deleteVariantAdmin`).

**Problema:** documented invariant, enforced only at creation. See **BE-04**
for the application-level consequence and fix. A DB-level constraint would
need a deferred constraint trigger, which is disproportionate here.

**Recomendação:** enforce in `deleteVariantAdmin` (BE-04) and add a data-
integrity check to the test suite that asserts no `product` has zero variants
after the admin test run. Optionally add a periodic check to the seed/health
script.

---

### DB-07 The seed script is not idempotent and `drizzle.config.ts` has a hardcoded DB fallback

**Confidence: Confirmed** · **Severidade: P3**

**Localização:** `packages/db/src/seed.ts:5-25`, `seed-catalog.ts` (all plain
`INSERT`s, no `onConflict`); `packages/db/drizzle.config.ts:9-12`.

**Problema:** running `pnpm db:seed` twice fails on `category_slug_unique`,
`product_slug_unique`, `product_variant_sku_unique` and
`user_email_unique` — partway through, leaving a partially-seeded database
(the inserts are not wrapped in a transaction). `runbook.md` step 4 says
*"Seed the fantasy catalog, if this is a fresh instance"*, which puts the
burden on the operator to remember.

The hardcoded `drizzle.config.ts` fallback is covered under **ARCH-02**.

**Recomendação:**
1. Wrap `seedCatalog` + the admin insert in a single `db.transaction`.
2. Use `onConflictDoNothing({ target: … })` on every insert, or add an
   explicit `--reset` flag that TRUNCATEs first (the E2E fixture at
   `apps/web/e2e/fixtures/seed.ts:41-46` already has exactly this TRUNCATE
   list — reuse it rather than duplicating).
3. The seeded admin (`seed.ts:18-23`) has no credential and cannot sign in.
   That is deliberate and commented, but `runbook.md` never tells an operator
   how to get an admin account. Add the documented `UPDATE "user" SET role =
   'admin' WHERE email = '…'` step to the runbook.

**Testes necessários:** integration — run the seed twice against a fresh DB;
the second run is a no-op (or resets cleanly) and the row counts are
unchanged.

---

### DB-08 `processed_webhook_event` grows without bound and has no retention policy

**Confidence: Confirmed** · **Severidade: P3**

**Localização:** `packages/db/src/schema/payment.ts:44-48`

**Problema:** one row per webhook event, forever. It is the idempotency
ledger, so rows cannot be dropped casually — but Stripe's retry window is
finite (~3 days), so rows older than that serve no purpose. At real volume
this becomes the largest table in the database with a `text` primary key.

**Recomendação:** document a retention rule (e.g. delete rows older than 30
days) and add it as a maintenance command alongside DB-07's seed script. Add
an index on `processed_at` to make the delete cheap. Note the reasoning in
`architecture.md` §3, which currently describes the table without mentioning
lifecycle.

---

### DB-09 `analytics_event` grows without bound, has no index, and is writable by anonymous users

**Confidence: Confirmed** · **Severidade: P2**

**Localização:** `packages/db/src/schema/ops.ts:47-55`;
`apps/web/app/api/analytics/track/route.ts`

**Problema:** the table has zero indexes (DB-01), zero retention, and its only
writer is an **unauthenticated, unrate-limited** endpoint (SEC-05). Every
page view of every visitor inserts a row. `conversionFunnel` then does
`count(distinct session_id)` over the whole table filtered by a date range it
cannot index.

This is the one table where the three findings compound into something real:
an attacker can inflate it arbitrarily (SEC-05), which makes the admin
analytics page progressively slower (DB-01) with no cleanup path (this
finding).

**Recomendação:**
1. Indexes per DB-01.
2. Retention: delete events older than 90 days (the dashboard's longest
   window is 30). Document it.
3. Consider monthly partitioning if this is meant to look production-grade —
   but at this project's scale, retention + indexes is the proportionate
   answer, and saying so in `architecture.md` is better engineering signal
   than over-building.
4. Rate-limit the write endpoint (SEC-05).

**Testes necessários:** integration — the retention command deletes only rows
older than the cutoff; `conversionFunnel` results are unchanged for the
in-window data.

---

### DB-10 `feature_flag` is a dead table

**Confidence: Confirmed** · **Severidade: P3**

**Localização:** `packages/db/src/schema/content.ts:26-31`. Grep for
`featureFlag` across the repo: only the schema definition and the barrel
export.

**Problema:** created in migration `0000`, referenced by no query, no UI, no
test. `plan.md` §21 describes an admin toggle UI that does not exist
(ARCH-03).

**Recomendação:** either build the (small) admin toggle, or drop the table in
a migration and move the design note into `plan.md` §21 as an explicit
"not built — here's where it would go". Leaving an empty table in the schema
is the worst of the three options: it implies a feature that doesn't exist.

---

## Migration review

All six migrations are additive and safe:

| Migration | Change | Notes |
|---|---|---|
| `0000_rare_killer_shrike` | 22 tables, all enums, 7 indexes, all FKs, all CHECKs | The `tsvector` generated column is inline — good |
| `0001_reconcile_auth_with_better_auth` | 3 indexes + NOT NULLs on `verification` | Reconciled against `@better-auth/cli generate` — good practice |
| `0002_bright_ultragirl` | `product.is_featured` + partial index | Partial index `WHERE status = 'active'` — well chosen |
| `0003_nice_nicolaos` | `CREATE EXTENSION pg_trgm` + trigram GIN index | See PERF-02 — the index is never used by the query written for it |
| `0004_windy_riptide` | `UNIQUE` on `cart.user_id` | Real gap found and fixed |
| `0005_previous_lady_ursula` | `order.cart_id` | Real gap found and fixed; **no index added** (DB-01) |

**Observations:**

- No migration has ever dropped a column or changed a type, so the
  "additive/backward-compatible for at least one deploy" claim in
  `runbook.md` §"Updating a running self-host instance" holds so far.
- There are no `down` migrations, which `runbook.md` §Rollback correctly
  discloses.
- Migrations are applied by `drizzle-kit migrate` as an explicit CI/ops step,
  never on app boot — verified: no `migrate()` call exists in application
  code, and `Dockerfile` deliberately excludes `drizzle-kit` from the runtime
  image. This matches the stated rule and is done correctly.
- **Gap:** none of the planned migrations (DB-01 indexes, DB-02 timestamptz,
  DB-06 payment constraints) can be created `CONCURRENTLY` by drizzle-kit.
  Add a line to `runbook.md` explaining when to hand-edit the generated SQL.
