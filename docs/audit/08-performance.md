# 08 — Performance

Findings: `PERF-01` … `PERF-07`.

**Scope note:** this file only lists changes with a concrete, explainable
benefit. Micro-optimisations with no measurable payoff at this project's scale
are deliberately excluded, and a "do not optimise" list is at the bottom.

---

## 1. Current cost profile

Every page is dynamically rendered (ARCH-01), so every request pays full
database cost. Measured by counting queries in the source:

| Route | Queries per request | Breakdown |
|---|---|---|
| `/` (landing) | **6** (7 signed in) | `SiteHeader`: session + `listCategoryTree` + `getCartDetail` (2: cart lookup + items). Page: 2× `listActiveBanners` + `listCategoryTree` **again** + `listProducts` (2: count + rows) + `getWishlistedProductIds` |
| `/catalog` | **7–8** | header 4 + `listCategoryTree` (3rd time) + `listMaterials` + `listProducts` ×2 |
| `/product/[slug]` | **7–8** | header 4 + `getProductBySlug` (3) + `listRelatedProducts` + wishlist |
| `/cart` | **5** | header 4 + cart detail |
| `/checkout` | **5** | header 4 + cart detail |
| `/order/confirmation/[id]` | **7–8** | header 4 + `getOrderById` (3–4) |
| `/admin/analytics` | **9** | header 4 + 5 aggregates, three of which seq-scan |

The header alone is **4 queries on every single request**, including for
anonymous visitors on static-content pages like `/privacy`.

---

## PERF-01 `revalidatePath("/", "layout")` invalidates the entire site on every cart mutation and every payment

**Confidence: Confirmed**

### Localização

- `apps/web/lib/actions/cart.ts:33` (`addToCartAction`)
- `apps/web/lib/actions/cart.ts:58` (`updateCartItemAction`)
- `apps/web/lib/actions/cart.ts:70` (`removeCartItemAction`)
- `apps/web/lib/actions/cart.ts:81` (`mergeCartOnLogin`)
- `apps/web/lib/actions/mock-checkout.ts:34` (`approveMockPayment`)
- `apps/web/app/api/webhooks/stripe/route.ts:49` (the Stripe webhook)

### Problema

`revalidatePath("/", "layout")` is the broadest invalidation Next.js offers:
it invalidates the root layout and **every route nested under it** — which is
every route in the application.

It is called on six paths, including two that are not user-initiated:

- **Every `+`/`−` click in the cart drawer.** A customer adjusting a quantity
  three times issues three whole-site invalidations.
- **Every webhook delivery.** Stripe's retries, expired-session events, and
  every successful payment each blow the entire cache.

The *intent* is correct — the cart badge lives in the root layout's
`SiteHeader`, so a cart change must refresh the layout. The *scope* is not.

Today the direct cost is muted because nothing is cached (ARCH-01), so there
is little to invalidate. What it does cost today:

- The client receives a fresh RSC payload for the **whole page tree** after
  every quantity click, not just the header. On `/catalog` that means the
  product grid, filters and sidebar are all re-rendered and re-serialised
  server-side to change one number in the header. That is the mechanism behind
  the sluggishness described in **FE-02**.
- On the webhook path it is pure waste: the webhook has no client to update.

The moment ARCH-01's ISR work lands, this becomes actively harmful: every
add-to-cart by any visitor would evict the entire cached storefront for
everyone.

### Cenário que reproduz o problema

Open `/catalog` (24 products), open the cart drawer, and click `+` on a line
item while watching the Network tab. Each click produces an RSC payload
containing the full catalog grid, not just the header fragment. Throttle to
Slow 3G and the lag is obvious.

### Impacto

- Segurança: nenhum
- Correção: nenhum
- Performance: **alto** (today: oversized payloads per interaction; after
  ARCH-01: full cache eviction on every cart action)
- Manutenção: médio
- UX: médio

### Severidade

**P1** (jointly with ARCH-01 — they must be fixed together)

### Recomendação

1. **Make the cart badge self-updating instead of layout-revalidating.**
   Once ARCH-01 moves `CartDrawer` into a Suspense island, have the cart
   actions return the new `itemCount`/`subtotalCents` and update the badge
   client-side (`useOptimistic` + the returned value). Then no revalidation is
   needed for a quantity change at all.
2. **Where revalidation is genuinely required, scope it.** Replace the six
   calls with cache **tags**:
   | Call site | Replace with |
   |---|---|
   | `addToCartAction` | nothing (client-side update per 1); optionally `revalidateTag("cart:" + ownerKey)` |
   | `updateCartItemAction` / `removeCartItemAction` | same |
   | `mergeCartOnLogin` | `revalidatePath("/cart")` only |
   | `approveMockPayment` / webhook | `revalidateTag("product:" + slug)` for each ordered item (stock changed) + `revalidateTag("products")`; **never** the root layout |
3. **Never revalidate from the webhook's request path for UI reasons.** The
   only thing that legitimately changed for the storefront is stock. Tag it
   precisely.

### Dependências

**Must be done with ARCH-01.** Removing the layout revalidation before the
cart badge has another update mechanism would break the badge.

### Testes necessários

- Component/E2E: adding to cart updates the header badge without a full page
  navigation.
- Integration: `addToCartAction` does not call `revalidatePath("/", "layout")`
  (spy assertion).
- E2E: after a mock payment approval, the product page shows the decremented
  stock (proving the targeted tag works).

---

## PERF-02 The trigram index cannot be used by the search query it was created for

**Confidence: Likely** (Postgres planner behaviour — verification below)

### Localização

- `packages/db/src/queries/products.ts:55-59` (`searchCondition`)
- `packages/db/src/queries/products.ts:62-67` (`relevanceExpr`)
- `packages/db/migrations/0003_nice_nicolaos.sql:2` — the index
- `packages/db/src/schema/product.ts:60` — the schema declaration

### Problema

Migration `0003` creates:

```sql
CREATE INDEX "product_name_trgm_idx" ON "product" USING gin ("name" gin_trgm_ops);
```

The query that is supposed to use it is:

```sql
word_similarity($1, "product"."name") > 0.2
```

`pg_trgm`'s GIN operator class supports the **operators** `%`, `<%`, `%>`,
`<<%`, `%>>` and `<->` variants. It does **not** support a comparison against
the *function* `word_similarity(...)`. Only the `<%` operator (which compares
against the session-level `pg_trgm.word_similarity_threshold` GUC) is
index-accelerated.

So `product_name_trgm_idx` is never used by this query. Every search executes:

1. a **sequential scan** of `product`,
2. computing `word_similarity()` for **every row** (trigram set construction
   per row — the expensive part),
3. …and then does it **again** for the `count(*)` query
   (`products.ts:173-176`), because `listProducts` runs count and rows as two
   separate statements with the same `WHERE`.

The full-text half (`search_vector @@ websearch_to_tsquery(...)`) *is* indexed
by `product_search_idx` and works correctly. But because the two conditions
are `OR`ed, the planner cannot use the GIN index for the whole predicate —
an `OR` with an unindexable branch forces a full scan regardless.

`relevanceExpr` (used for `ORDER BY` when a query is present) calls
`word_similarity` a second time per row, doubling the per-row cost.

### Verification

```sql
EXPLAIN ANALYZE
SELECT count(*)::int FROM product
WHERE status = 'active'
  AND (search_vector @@ websearch_to_tsquery('english', 'sword')
       OR word_similarity('sword', name) > 0.2);
```
Expect `Seq Scan on product` with no `Bitmap Index Scan on product_name_trgm_idx`.
Confirm before implementing.

### Por que isso é um problema

`architecture.md` §7 and `plan.md` §11 both present this as an indexed design:
*"a generated `tsvector` column … with a GIN index, plus `pg_trgm` for
typo-tolerant fallback matching"*, and `spec.md` §11 requires *"Database
queries for catalog listing are covered by indexes (category, price, full-text
search GIN index)"*. The FTS index is real; the trigram one is decoration.

At 36 seeded products this is unmeasurable. The cost is O(n) in products, paid
twice per search, and search is the highest-intent action on a storefront.

### Impacto

- Segurança: nenhum
- Correção: nenhum (results are correct)
- Performance: **médio** (linear scan per search, doubled; unused index still
  costs write amplification on every product insert/update)
- Manutenção: médio (a documented optimisation that doesn't apply)
- UX: baixo today, degrades with catalog size

### Severidade

**P2**

### Recomendação

1. **Use the indexable operator.** Replace the fallback with `<%`:
   ```sql
   ($1 <% product.name)
   ```
   and set the threshold per-statement rather than relying on the default:
   `SET LOCAL pg_trgm.word_similarity_threshold = 0.2;` inside the transaction,
   or set it once at the database level and document it. `<%` is exactly
   `word_similarity(a,b) > pg_trgm.word_similarity_threshold`, and it **is**
   index-accelerated by `gin_trgm_ops`.
2. **Run the fallback only when FTS returns nothing**, instead of `OR`ing them.
   That is what `plan.md` §11 actually specifies — *"`pg_trgm` for fuzzy
   fallback **when FTS returns nothing**"* — and the current code doesn't do
   it. Two cheap indexed queries beat one unindexable one:
   ```
   rows = ftsQuery();  if (rows.length === 0) rows = trigramQuery();
   ```
   This also removes the `OR` that defeats the FTS index.
3. **Stop running the count query separately** for searches. Use a window
   function (`count(*) OVER ()`) in the same statement, so `word_similarity`
   (or the trigram scan) is paid once, not twice.
4. Keep `relevanceExpr` for ordering, but only within the already-filtered
   result set.

### Dependências

None. Contained to `products.ts` plus possibly one migration if the threshold
is set at database level.

### Testes necessários

- The existing search tests (`products.test.ts`: *"falls back to trigram
  similarity for a typo"*, *"tolerates a realistic typo against seed product
  names"*, *"ranks a closer name match above a description-only match"*) must
  all still pass — they are the behavioural contract.
- Add a plan assertion: `EXPLAIN (FORMAT JSON)` for the trigram path contains
  a `Bitmap Index Scan` on `product_name_trgm_idx`.
- Add a test that a query matching via FTS does **not** trigger the fallback
  query (assert query count via the existing `onQuery` hook).

---

## PERF-03 No caching layer of any kind

**Confidence: Confirmed** · **Severidade: P1** (tracked as **ARCH-01**)

Cross-reference only. `architecture.md` §8 specifies two cache layers:

- **ISR** for catalog/category/product — not implemented (ARCH-01).
- **Upstash Redis** *"for … short-lived read-through caches for hot aggregate
  queries (e.g. homepage featured products)"* — not implemented. `packages/ratelimit`
  uses Upstash, but there is no read cache anywhere; grep for
  `Redis` outside `packages/ratelimit` returns nothing.

The consequence is the query counts in §1: `listCategoryTree` runs **twice**
per landing-page request (once in `SiteHeader`, once in `Home`), and
`listActiveBanners` runs on every homepage view for a table that changes
weekly at most.

**Recomendação:** fold into ARCH-01. The cheapest high-value wins, in order:

1. Wrap `listCategoryTree` in `unstable_cache` with tag `categories` — it is
   requested 2–3× per page render across the header, sidebar and page body,
   and changes only via admin category CRUD.
2. Same for `listActiveBanners` (tag `banners`) and `listMaterials`
   (tag `products`).
3. Then ISR for the storefront routes.

React's per-request `cache()` would also deduplicate the double
`listCategoryTree` within one render — that alone is a two-line change with an
immediate 1-query-per-request saving and no cache-invalidation risk. Do that
first, independently of ARCH-01.

---

## PERF-04 The site header issues four queries on every request, including on static content pages

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`apps/web/components/site-header.tsx:14-19`, mounted unconditionally in
`apps/web/app/layout.tsx:58`.

```ts
const [session, categories, cart] = await Promise.all([
  getSession(),            // Better Auth: cookie-cache hit, or 1 DB query
  listCategoryTree(db),    // 1 query
  getCurrentCartDetail(),  // 2 queries (getCart, then the item join)
]);
```

### Problema

Four database round trips before any page-specific work begins — on
`/privacy`, `/terms`, `/shipping-returns`, the 404 page, and every other
route. `Promise.all` parallelises them, so latency is bounded by the slowest,
but connection and query cost is paid four times per request.

`getCurrentCartDetail` is the wasteful one: it fetches **full cart contents**
(join to `product_variant`, `product`, plus a correlated image subquery for
every line) purely so the header can render a badge with `cart.itemCount` —
and so `CartDrawer` can be pre-populated even when the drawer is closed and
may never be opened.

This is also the root cause of **ARCH-01**: reading cookies here opts every
route out of static rendering.

### Recomendação

1. **Split the read.** The header needs only a count. Add
   `getCartItemCount(db, owner)` — a single `SELECT coalesce(sum(quantity),0)
   FROM cart_item JOIN cart …` — and use it for the badge.
2. **Load the drawer's contents on open**, not on every page render. `Sheet`
   already has open state; fetch when it opens (a Server Action or a
   `<Suspense>` boundary inside `SheetContent`).
3. **Deduplicate `listCategoryTree`** with React `cache()` (PERF-03).
4. Combined with ARCH-01's Suspense islands, a static page then costs **zero**
   queries in the shell.

### Testes necessários

- Integration: rendering `/privacy` issues zero cart/category queries (use the
  existing `onQuery` counting hook).
- E2E: the cart badge count is correct on first paint; opening the drawer
  shows the correct contents.

---

## PERF-05 `getOrderById` performs 3–4 sequential round trips

**Confidence: Confirmed** · **Severidade: P3**

### Localização

`packages/db/src/queries/orders.ts:198-229`

### Problema

Four `await`s in sequence, no `Promise.all`:

1. `SELECT * FROM "order" WHERE id = …`
2. `SELECT … FROM order_item WHERE order_id = …`
3. `SELECT status FROM payment WHERE order_id = … ORDER BY created_at DESC LIMIT 1`
4. (conditional) `SELECT email FROM "user" WHERE id = …`

Queries 2, 3 and 4 are independent of each other and all depend only on
query 1. They are serialised for no reason — 4× the network round-trip
latency, which on a serverless-to-Neon path is the dominant cost.

Query 3 additionally seq-scans `payment` (DB-01).

`getOrderById` is called from five places: the confirmation page, the admin
order page, the mock checkout page, `getOrderForUser`, `getOrderForGuestLookup`
and `sendOrderConfirmationEmail`.

### Recomendação

Run 2–4 in parallel after 1 resolves:

```ts
const [items, [latestPayment], userRow] = await Promise.all([
  db.select(…).from(orderItem)…,
  db.select(…).from(payment)…,
  orderRow.userId && !orderRow.guestEmail
    ? db.select({ email: user.email }).from(user).where(eq(user.id, orderRow.userId)).limit(1)
    : Promise.resolve([]),
]);
```

Alternatively a single query with a `leftJoin` to `user` and a lateral join for
the latest payment — but the parallel version is a three-line change with the
same benefit and no plan risk.

**Note:** `getOrderForUser` (`orders.ts:232-236`) calls `getOrderById` and
*then* filters by `userId` in JavaScript. That is correct for security (same
404 either way) but means an unauthorised request still executes all four
queries. Add a cheap `SELECT user_id` pre-check, or push the `userId` filter
into query 1.

### Testes necessários

- The existing `getOrderById` tests must pass unchanged.
- Query-count assertion: ≤ 4 queries, and the wall-clock is ~1 round trip
  after the first (hard to assert directly — a query-count assertion plus code
  review is sufficient).

---

## PERF-06 Offset pagination on tables with no supporting index

**Confidence: Confirmed** · **Severidade: P3**

### Localização

`queries/products.ts:200`, `admin-products.ts:85`, `admin-orders.ts:59`,
`admin-users.ts:40`, `admin-audit.ts:66` — all `.limit(n).offset((page-1)*n)`.

### Problema

`OFFSET n` requires the database to produce and discard `n` rows. Combined
with the missing sort indexes (DB-01), `/admin/orders?page=50` sorts the
entire `order` table and throws away 980 rows.

Each list also runs a **separate `count(*)`** over the same predicate to
compute `totalPages` — doubling the scan.

At current data volumes this is invisible. It becomes the admin panel's
bottleneck first, since `audit_log` and `analytics_event` grow fastest and
have no indexes at all.

### Recomendação

Ordered by cost/benefit:

1. **Add the indexes** (DB-01) — this alone removes the sort cost and makes
   offset scanning index-only. Sufficient for this project's scale.
2. **Merge the count into the main query** with `count(*) OVER ()` so each
   list page is one statement instead of two.
3. Keyset ("seek") pagination is the correct long-term answer for
   `audit_log`/`analytics_event`, but it changes the UI contract (no page
   numbers). **Do not do this now** — it is disproportionate. Note it as the
   documented upgrade path.

### Testes necessários

Existing pagination tests must pass. Add a plan assertion that the ordered
list query uses an index scan after DB-01.

---

## PERF-07 Client bundle and asset review

**Confidence: Confirmed** · **Severidade: P3**

### What is already right

`tasks.md` 10.6 documents a manual performance pass, and I re-verified its
claims:

- **100% `next/image`** — grep for `<img` across `apps/web` and `packages/ui`
  returns zero raw tags. Every image uses `fill` + `sizes`.
- **`next/font/google` self-hosting** — three fonts (`Geist`, `Geist_Mono`,
  `Cinzel`) loaded via `next/font`, so no render-blocking external request and
  no layout shift.
- **Sentry is dynamically imported.** `lib/monitoring.ts:10` and
  `instrumentation-client.ts:7` both use `await import("@sentry/nextjs")`
  gated on the DSN env var, so the ~400 KB SDK is not in the shared chunk when
  no DSN is configured. This was a real regression caught in 10.6 and the fix
  held — do not undo it.
- **Client Components are minimal** — 24 files, all genuinely interactive.

### Remaining opportunities

| Item | Localização | Assessment |
|---|---|---|
| Three font families | `app/layout.tsx:12-25` | `Geist_Mono` is loaded on every page and used by **one** element: the audit-log action column (`admin/audit-log/page.tsx`, `font-mono`). That is a full font family for one admin table. Drop it and use the system mono stack, or scope it to the admin route group. |
| `lucide-react` | many components | Tree-shakes correctly with named imports (which is what's used). No action. |
| `radix-ui` meta-package | `packages/ui/package.json:20` | The single `radix-ui` package re-exports all primitives. Verify tree-shaking actually drops the unused ones in the production build (`.next/analyze` or `@next/bundle-analyzer`); if not, switch to individual `@radix-ui/react-*` packages. **Verify before acting.** |
| Seed images from `picsum.photos` | `packages/db/src/seed-catalog.ts:4-6` | Every seeded product image is an external HTTPS fetch through the Next image optimiser on first render. Fine for a demo; it does mean the "fully offline" self-host story (`architecture.md` §10B) isn't actually offline. Worth a line in the runbook, or ship a handful of local placeholder assets. |
| No `priority` audit | `hero-carousel.tsx:39`, `product-gallery.tsx:68` | Both correctly mark the LCP image `priority`. ✅ |
| `pino` transport in dev | `lib/logger.ts:13-16` | `pino-pretty` runs as a worker thread. Dev only (`NODE_ENV !== "production"`), so no production cost. ✅ |
| No Lighthouse in CI | `.github/workflows/ci.yml` | `spec.md` §8 makes Lighthouse ≥90 a success criterion; `tasks.md` 10.6/11 defer it twice for lack of a local Chrome. CI **has** Chrome (the E2E job installs it). Add `treosh/lighthouse-ci-action` against the already-running `next start` in the E2E job. Tracked as **CFG-05**. |

### Recomendação

1. Drop `Geist_Mono` from the root layout (one-line, immediate saving on every
   page).
2. Add Lighthouse CI to the E2E job (CFG-05) — it is the only way the stated
   success criterion gets verified.
3. Verify the `radix-ui` tree-shaking question with the bundle analyzer before
   changing anything.

---

## Do not optimise these

Recorded to prevent wasted effort:

- **`listProducts`'s correlated subqueries** for `imageUrl`/`imageAlt`/
  `inStock` (`products.ts:192-194`). They look like N+1 but are not — they are
  correlated subqueries evaluated inside one statement, and there is a real
  test asserting the query count does not grow with row count
  (`products.test.ts`, *"issues the same number of queries whether 5 or 20
  rows are returned"*). Leave them.
- **`listCategoryTree` building the tree in JS.** One query, small table,
  clear code. A recursive CTE would be slower and harder to read.
- **`getWishlistedProductIds` returning a `Set`.** It is a single batch query
  for the whole listing page — exactly the right shape. It is consumed on the
  server (`wishlistedIds?.has(id)` evaluates before serialisation), so the
  non-serialisable `Set` never crosses the RSC boundary. Correct as written.
- **`OrderStatusPoller`'s 2 s interval for 20 s.** Ten `router.refresh()` calls
  in the worst case, only while a payment is genuinely pending. Proportionate.
  (It does need a terminal state — see ECM-10 — but not a performance change.)
- **`MemoryRateLimiter`'s unbounded `Map`.** Documented as per-process and
  fine at single-instance scale (`packages/ratelimit/src/providers/memory.ts:5-11`).
  It never evicts expired buckets, so it grows with distinct keys — worth a
  comment, not a rewrite, unless SEC-04's fix keys it on something
  high-cardinality.
- **`packages/email`'s React Email rendering.** Runs once per email, off the
  request path (best-effort, after the fulfilment transaction). Fine.
