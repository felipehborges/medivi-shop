# 01 — Architecture

Findings: `ARCH-01` … `ARCH-06`.

---

## 1. The architecture as built

### 1.1 Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│  · Client Components (cart drawer, forms, gallery, beacons) │
│  · better-auth/react client (fetch → /api/auth/*)           │
└───────────┬─────────────────────────────────┬───────────────┘
            │ RSC payload / Server Action RPC │ fetch
┌───────────▼─────────────────────────────────▼───────────────┐
│ Next.js server (single Node process)                        │
│  proxy.ts  →  route group layout  →  page.tsx (RSC)         │
│                                   →  Server Action           │
│                                   →  Route Handler           │
│  lib/auth-guards.ts   (requireUser / requireAdmin)          │
│  lib/schemas/*.ts     (Zod, shared with the client forms)   │
└───────────┬───────────────────────────┬─────────────────────┘
            │ direct function call      │ provider interface
┌───────────▼──────────────┐  ┌─────────▼───────────────────┐
│ packages/db              │  │ packages/{payments,email,    │
│  queries/*.ts (business  │  │  storage,ratelimit}          │
│  logic + SQL, one file   │  │  interface + 2 impls each    │
│  per domain)             │  └─────────┬───────────────────┘
│  schema/*.ts             │            │
└───────────┬──────────────┘            ▼
            ▼                   Stripe / Resend / S3 / Upstash
        PostgreSQL
```

### 1.2 Dependency direction — verified clean

I checked every import across the workspace:

- `apps/web` → `packages/*` ✅ (never the reverse)
- `packages/*` → `packages/*`: **zero** cross-package imports. `payments`,
  `email`, `storage`, `ratelimit` are fully standalone; they don't even
  depend on `db`, which is *stricter* than `architecture.md` §11 allows.
- No circular imports. `packages/db/src/lib/db-client.ts` imports a *type*
  from `../client`, and `client.ts` imports `./schema` — the cycle is
  type-only and erased at compile time.

This is genuinely well done and needs no work.

### 1.3 Where business logic actually lives

| Concern | Location |
|---|---|
| Stock/price re-validation | `packages/db/src/queries/orders.ts` (`createOrder`) |
| Stock decrement + idempotency | `packages/db/src/queries/orders.ts` (`fulfillPaidOrder`) |
| Order status machine | split: `orders.ts` (`markOrderRefunded`), `admin-orders.ts` (`markOrderFulfilledAdmin`) |
| Cart merge rules | `packages/db/src/queries/cart.ts` |
| Address default rules | `packages/db/src/queries/addresses.ts` |
| Shipping rates | `apps/web/lib/shipping.ts` (a const array) |
| Authorization | `apps/web/lib/auth-guards.ts` + call sites |
| Rate limiting | `apps/web/lib/rate-limit.ts` + call sites |

The intent from `plan.md` §3 ("business logic lives in plain TypeScript
functions in `packages/db`") is followed for the DB-touching rules. The
*orchestration* rules (which provider to call, in what order, what to
revalidate) live in `apps/web/lib/actions/*`. That split is defensible; see
ARCH-05 for the one place it hurts.

---

## ARCH-01 ISR and on-demand revalidation are documented everywhere and implemented nowhere

**Confidence: Confirmed**

### Localização

- `apps/web/app/layout.tsx:58` (`<SiteHeader />`)
- `apps/web/components/site-header.tsx:15-19`
- Every `apps/web/app/**/page.tsx` (none export `revalidate`)
- `apps/web/lib/actions/admin-products.ts:27,41,57`
- `apps/web/lib/actions/admin-categories.ts:32,43,53`
- `apps/web/lib/actions/admin-banners.ts:30,40,49`
- `apps/web/lib/actions/admin-variants.ts:23,33,42,53`

### Problema

Three documents state the app uses ISR with on-demand revalidation:

- `spec.md` §10: *"Server-rendered/statically-generated product, category, and
  landing pages (Next.js App Router, ISR with on-demand revalidation on admin
  publish/edit)."*
- `spec.md` §11: *"Product/category pages use ISR so the common path is served
  from cache, not computed per request."*
- `plan.md` §14 / `architecture.md` §8: *"ISR for catalog/category/product
  pages; `revalidateTag`/`revalidatePath` triggered from admin mutations so
  publishes are immediate."*

None of it exists:

1. A repo-wide grep for `export const revalidate`, `generateStaticParams`,
   `unstable_cache`, `revalidateTag`, `cacheTag`, `cacheLife` returns **zero
   matches**. The only cache directive in the whole app is
   `export const dynamic = "force-dynamic"` in `app/sitemap.ts:7`.
2. Even if a page opted in, it could not be static: the **root layout** renders
   `SiteHeader`, which calls `getSession()` (reads request headers/cookies) and
   `getCurrentCartDetail()` (reads the guest-cart cookie). Reading cookies in a
   layout forces every route beneath it into dynamic rendering. There is no
   `<Suspense>` boundary isolating the header, so the opt-out is total.
3. Consequently there is no cache for `revalidatePath` to invalidate, and the
   admin mutations only ever revalidate `/admin/...` paths — **not one call
   site revalidates `/`, `/catalog`, `/catalog/[slug]` or `/product/[slug]`**.

### Por que isso é um problema

- Every catalog and product page view executes 4–6 Postgres queries. At the
  spec's target of Lighthouse ≥ 90 / LCP < 2.5s (spec §8, §11) this is the
  single largest structural obstacle: TTFB is bounded by DB latency on every
  request, including for anonymous first-time visitors.
- The moment someone *does* add ISR (the obvious "performance fix"), the
  storefront will silently serve stale product data forever, because the
  revalidation calls that would fix it are missing. The bug is latent today
  and becomes a data-correctness bug the day caching is enabled.
- The documentation actively misleads a reader (including a future maintainer,
  and — for a portfolio project — a reviewer) about how the system works.

### Cenário que reproduz o problema

*Today:* run `next build`. The build output lists every storefront route as
`ƒ (Dynamic)`, not `● (ISR)` or `○ (Static)`. Compare against `spec.md` §11.

*After a naive fix:* add `export const revalidate = 3600` to
`app/(storefront)/product/[slug]/page.tsx` and refactor the header behind
Suspense. Then, as an admin, change a product's price and publish. The
storefront keeps serving the old price for up to an hour, because
`updateProductAction` never calls `revalidatePath("/product/" + slug)`.

### Impacto

- Segurança: nenhum
- Correção: alto (latente — becomes live on the day caching is added)
- Performance: alto (no cache layer at all on the highest-traffic routes)
- Manutenção: alto (docs describe a system that doesn't exist)
- UX: médio (slower pages)

### Severidade

**P1**

### Recomendação

Do this as one coherent change, not piecemeal:

1. **Free the layout from request data.** Move the session-dependent and
   cart-dependent parts of `SiteHeader` into their own Client/Server
   components wrapped in `<Suspense>` with a static fallback, so the shell of
   `app/layout.tsx` no longer reads cookies at the top level. Concretely:
   `UserMenu`/sign-in buttons and `CartDrawer` become dynamic islands; the
   logo, `SearchBar` and `CategoryNav` stay static.
2. **Opt the read-only storefront routes into ISR**, with tags:
   - `app/page.tsx`, `app/(storefront)/catalog/page.tsx`,
     `catalog/[category]/page.tsx`, `product/[slug]/page.tsx`
   - Wrap the underlying queries in `unstable_cache` (or Next 16's `cacheTag`)
     with tags: `products`, `product:<slug>`, `categories`, `banners`.
   - Add `generateStaticParams` to `product/[slug]` (bounded — top N by
     featured/newest — not every product).
3. **Add revalidation to every mutation that changes storefront-visible data.**
   Minimum set:
   | Action | Must revalidate |
   |---|---|
   | `createProductAction`, `updateProductAction`, `setProductStatusAction` | `products`, `product:<slug>`, `categories` (counts) |
   | `uploadProductImageAction`, `deleteProductImageAction` | `product:<slug>` |
   | `createVariantAction`, `updateVariantAction`, `deleteVariantAction`, `adjustStockAction` | `product:<slug>`, `products` (in-stock filter) |
   | `createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction` | `categories`, `products` |
   | `createBannerAction`, `updateBannerAction`, `deleteBannerAction` | `banners` |
   | `fulfillPaidOrder` callers (webhook + mock approve) | `product:<slug>` for each ordered item (stock changed) |
4. **Do NOT keep `revalidatePath("/", "layout")`** — see PERF-01. Replace it
   with targeted tags.
5. If the team decides ISR is out of scope, that is a legitimate call — then
   **update `spec.md` §10/§11, `plan.md` §14 and `architecture.md` §8** to say
   so, in the same style as the deferred GitHub OAuth note in `tasks.md` 2.2.

### Dependências

- Must land **before** PERF-01 (`revalidatePath("/", "layout")` removal) so
  the cart badge still updates.
- Interacts with ARCH-03 (other doc-vs-code divergences) — resolve together.

### Testes necessários

- A build-output assertion (or a small script in CI) that `/`, `/catalog`,
  `/product/[slug]` are *not* listed as dynamic.
- An integration test: seed a product → read `/product/<slug>` → update its
  price via `updateProductAction` → re-read → assert the new price is served
  without waiting for the revalidate window.
- A test asserting the cart badge still updates after `addToCartAction`
  despite the header being a Suspense island.

---

## ARCH-02 Two independent environment-loading paths; `DATABASE_URL` bypasses the typed schema

**Confidence: Confirmed**

### Localização

- `apps/web/lib/env.ts:44-65`
- `packages/db/src/client.ts:1-13`
- `packages/db/src/lib/load-env.ts:10`
- `packages/db/drizzle.config.ts:9-12`

### Problema

`plan.md` §22 promises *"A single typed schema (Zod) validated at process boot
(`apps/web/lib/env.ts`)"*. In practice there are two:

1. `apps/web/lib/env.ts` — Zod schema, throws on invalid input, exports `env`.
2. `packages/db/src/client.ts` — `import "./lib/load-env"` (a raw
   `dotenv.config()` pointed at the repo-root `.env`), then reads
   `process.env.DATABASE_URL` directly with an ad-hoc `if (!connectionString)
   throw`.

`packages/db` cannot import `apps/web/lib/env.ts` (wrong direction), so this
duplication is structural, not accidental. But it has two concrete effects:

- `packages/db/src/lib/load-env.ts` runs `dotenv.config()` **unconditionally**,
  including inside the Next server process (because `apps/web` imports
  `@medivi/db/client`). In a container where `.env` doesn't exist that's a
  no-op; in a container where a stale `.env` was copied in, it would silently
  override the real runtime environment. `.dockerignore` currently excludes
  `.env`, so this is latent rather than live.
- `packages/db/drizzle.config.ts:9-12` falls back to a **hardcoded**
  `postgresql://medivi:medivi@localhost:5432/medivi_shop` when `DATABASE_URL`
  is unset. Running `pnpm db:migrate` in a shell that forgot to export the
  variable silently migrates the local dev database instead of failing.

### Por que isso é um problema

Two sources of truth for the same variable means the "fails fast at boot with
a clear error" guarantee is only true for `apps/web`'s vars, not for the one
variable everything depends on. The drizzle-config fallback is a real
foot-gun for the runbook's manual-migration workflow (`runbook.md` §Migrations),
where the operator types the connection string by hand.

### Cenário que reproduz o problema

An operator follows `runbook.md` "Deploying to Vercel → Migrations", but the
shell drops the env var (typo, wrong quoting, `sudo` stripping the env).
`pnpm --filter @medivi/db db:migrate` reports success — against
`localhost:5432`. Production is never migrated; the next deploy fails at
runtime with column-not-found errors.

### Impacto

- Segurança: baixo
- Correção: médio
- Performance: nenhum
- Manutenção: médio
- UX: nenhum

### Severidade

**P2**

### Recomendação

1. Remove the hardcoded fallback in `packages/db/drizzle.config.ts` — throw
   with a clear message if `DATABASE_URL` is unset.
2. Make `packages/db/src/lib/load-env.ts` a no-op when `process.env.DATABASE_URL`
   is already set, and only load `.env` when explicitly running a script
   (guard on `process.env.MEDIVI_LOAD_DOTENV === "1"`, set in the `db:*`
   package scripts). This stops dotenv from running inside the server process.
3. Extract the shared shape: a tiny `packages/config/env` module exporting a
   `databaseUrlSchema`, imported by both `apps/web/lib/env.ts` and
   `packages/db/src/client.ts`, so the validation rule is written once.

### Dependências

None. Safe to do independently.

### Testes necessários

- Unit: `drizzle.config.ts` throws when `DATABASE_URL` is absent.
- Unit: `load-env` does not overwrite an already-set `DATABASE_URL`.

---

## ARCH-03 Six documented capabilities do not exist in the code

**Confidence: Confirmed**

### Localização

Docs asserting them, and the (absent) implementation:

| Documented in | Claim | Reality |
|---|---|---|
| `plan.md` §19, last bullet | *"Health check route (`/api/health`) verifying DB connectivity, used by Docker Compose healthchecks"* | No `app/api/health/**` exists. `docker/docker-compose.prod.yml:9-22` has **no** healthcheck on the `app` service. |
| `spec.md` §9, last bullet | *"Automated `axe-core` scans in CI on key pages"* | `axe-core` is a devDependency (`apps/web/package.json:43`) and is imported by **nothing**. No CI step. |
| `plan.md` §16 | *"Component (Testing Library): cart drawer, filter panel, variant selector, admin forms"* | No `@testing-library/*`, no `jsdom`. `apps/web/vitest.config.ts:8` sets `environment: "node"`. |
| `spec.md` §10 | *"Per-page `generateMetadata` (title, description, canonical URL, Open Graph + Twitter card images)"* | No `alternates.canonical`, no `openGraph`, no `twitter` anywhere. Only `title`/`description`. |
| `plan.md` §21 | *"A simple `FeatureFlag` table … with an admin toggle UI"* | Table exists (`packages/db/src/schema/content.ts:26-31`), is referenced by **zero** queries and has no UI. |
| `plan.md` §24, `architecture.md` §2 | *"Zustand for local UI state"* | Zustand is not a dependency anywhere. All client state is `useState`. |

### Por que isso é um problema

For a project whose stated purpose is *"evidence of engineering judgment"*
(spec §2, Portfolio-reviewer persona), a reviewer who reads the docs and then
the code finds six claims that don't hold. That is worse than not claiming
them. Operationally, the missing health check is the one with real impact:
`docker compose up` reports `app` as healthy the instant the container starts,
before Next has bound a port or reached Postgres.

Note the project already has the right pattern for this — `tasks.md` 2.2
explicitly marks GitHub OAuth as deferred, with a reason and a re-entry
point. These six should be handled the same way.

### Impacto

- Segurança: baixo
- Correção: baixo
- Performance: nenhum
- Manutenção: alto
- UX: nenhum

### Severidade

**P2** (individual sub-items are tracked separately where they have their own
impact: CFG-03 health check, TST-01 component tests, TST-02 axe, SEO-01
canonical/OG.)

### Recomendação

For each row: either build it or mark it deferred in the owning doc with a
one-line reason and the trigger to revisit. Recommended split:

- **Build**: `/api/health` (CFG-03), canonical + OG metadata (SEO-01), axe in
  CI (TST-02) — all small and directly serve stated success criteria.
- **Build, larger**: component tests (TST-01).
- **Defer explicitly**: `FeatureFlag` UI, Zustand (the app genuinely doesn't
  need a client store — say so; that's the better engineering statement).

### Dependências

CFG-03 blocks nothing. TST-01/TST-02 need tooling added first (see
`10-dependencies-and-config.md`).

### Testes necessários

Each sub-item carries its own; see the individual findings.

---

## ARCH-04 `(account)` route group mixes public and protected pages

**Confidence: Confirmed** · **Severidade: P3**

### Localização

`apps/web/app/(account)/` contains `sign-in/`, `sign-up/`, `forgot-password/`,
`reset-password/` (all public) alongside `account/`, `wishlist/` (protected).
`apps/web/proxy.ts:27` matches only `/account/:path*`, `/admin/:path*`,
`/wishlist/:path*`.

### Problema

The route group name implies "the authenticated area". It isn't — four of its
six subtrees are the *unauthenticated* auth pages. The proxy matcher is
correct (it matches paths, not groups), so there is no security consequence
today. The risk is a future maintainer adding a guard at the group's
`layout.tsx` and locking users out of `/sign-in`, or extending the proxy
matcher to `/(account)` semantics.

Concretely it also means `(account)/error.tsx` and `(account)/loading.tsx`
render for the sign-in page, which is harmless but not what the names suggest.

### Impacto

Manutenção: médio. Everything else: nenhum.

### Recomendação

Split into `(auth)` — `sign-in`, `sign-up`, `forgot-password`,
`reset-password` — and `(account)` — `account/**`, `wishlist`. Add a short
comment in each group's `layout.tsx` stating the guard contract. This is a
pure file move plus two new `error.tsx`/`loading.tsx`.

### Testes necessários

Existing proxy tests (`apps/web/proxy.test.ts`) already assert redirect
behaviour by path and will keep passing. Add one asserting `/sign-in` is
reachable without a session.

---

## ARCH-05 The order status machine is split across three files with no single owner

**Confidence: Confirmed** · **Severidade: P2**

### Localização

- `packages/db/src/queries/orders.ts:311` (`fulfillPaidOrder`: `pending → paid`)
- `packages/db/src/queries/orders.ts:374` (`recordPaymentFailure`: stays `pending`)
- `packages/db/src/queries/orders.ts:416` (`markOrderRefunded`: `paid|fulfilled → refunded`)
- `packages/db/src/queries/admin-orders.ts:77` (`markOrderFulfilledAdmin`: `paid → fulfilled`)
- `apps/web/lib/actions/orders.ts:29` (`refundOrderAction`: adds a *payment*-status precondition)
- `packages/db/src/schema/order.ts:18-24` (the enum, including unused `cancelled`)

### Problema

`plan.md` §9 defines one state machine:
`pending → paid → fulfilled`, `paid → refunded`, `pending → cancelled`.

The implementation scatters the transitions across four functions in two
files, each encoding its own precondition in a different style:

| Transition | Where | Precondition style |
|---|---|---|
| `pending → paid` | `orders.ts:358-360` | `WHERE status = 'pending'` in the UPDATE |
| `paid → fulfilled` | `admin-orders.ts:83-88` | `WHERE status = 'paid'` in the UPDATE |
| `paid\|fulfilled → refunded` | `orders.ts:418-421` | a `SELECT` then an `if` |
| — plus — | `actions/orders.ts:35` | a *payment*-status check (`succeeded`) not present in the DB layer |
| `pending → cancelled` | **nowhere** | never implemented; enum value is dead |

There is no single function that answers "is transition X→Y legal?", and no
test that enumerates the matrix. Three consequences already visible:

- ECM-04: the paid transition is guarded but the *payment* update in the same
  function is not, so they can diverge.
- ECM-06: `cancelled` is unreachable, so an expired Stripe session leaves an
  order `pending` forever, contradicting `spec.md` §7.
- The refund precondition is enforced in two places with two different
  predicates (order status vs. payment status), which is why ECM-03 can fire.

### Impacto

- Correção: alto (this is the root cause of ECM-03/04/06)
- Manutenção: alto
- Others: nenhum

### Recomendação

Introduce one module, e.g. `packages/db/src/domain/order-status.ts`:

```ts
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending:   ["paid", "cancelled"],
  paid:      ["fulfilled", "refunded"],
  fulfilled: ["refunded"],
  cancelled: [],
  refunded:  [],
};
export function canTransition(from: OrderStatus, to: OrderStatus): boolean
export function assertTransition(from: OrderStatus, to: OrderStatus): void
```

Have all four call sites route their guard through it, keeping the
`WHERE status = ...` clause as the *concurrency* guard (it must stay — it's
what makes the update atomic) and using `canTransition` as the *readable*
declaration of intent. Add `cancelled` as a real transition (ECM-06).

### Dependências

Land **before** ECM-03, ECM-04 and ECM-06 — all three fixes touch these call
sites, and doing them on top of a single table avoids three near-duplicate
edits.

### Testes necessários

- A table-driven unit test over the full 5×5 transition matrix.
- One integration test per legal transition asserting the DB reaches the
  expected state *and* writes the expected audit-log row.
- One integration test per illegal transition asserting the typed rejection
  and that **no** row changed.

---

## ARCH-06 The mock payment provider's surface area is not gated by `PAYMENT_PROVIDER`

**Confidence: Confirmed** · **Severidade: P1 (architecture view; the security
view is P0 — see SEC-01)**

### Localização

- `apps/web/lib/payments.ts:8-20` (the only place `PAYMENT_PROVIDER` is read)
- `apps/web/app/(storefront)/checkout/mock/[token]/page.tsx` (no gate)
- `apps/web/lib/actions/mock-checkout.ts` (no gate)
- `packages/payments/src/providers/mock.ts:13-16` (a comment asserting the gate)

### Problema

The design intent — stated in `architecture.md` §5, `plan.md` §8 and in a
comment in `mock.ts` — is that the mock provider *"only ever runs with
`PAYMENT_PROVIDER=mock`"*. That is true of the **provider object** and false
of everything else. The route `/checkout/mock/[token]` and the two Server
Actions it uses are compiled into every build and registered in the
Server-Actions manifest regardless of the env var, because Next builds the
whole `app/` tree.

Architecturally: the provider abstraction leaked. A provider is supposed to
be swappable behind an interface, but `MockProvider` also owns *routes and
actions* in the host app, which the interface has no way to activate or
deactivate.

### Impacto

- Segurança: crítico (see SEC-01 for the exploit)
- Correção: alto
- Manutenção: médio
- Others: nenhum

### Recomendação

Two complementary changes:

1. **Runtime gate (do this first, it's the security fix).** At the top of
   `approveMockPayment`, `declineMockPayment` and the mock page:
   ```ts
   if (env.PAYMENT_PROVIDER !== "mock") notFound();   // page
   if (env.PAYMENT_PROVIDER !== "mock") throw new Error("mock provider disabled"); // actions
   ```
2. **Structural gate (do this second).** Give `PaymentProvider` an optional
   `devRoutes` capability, or — simpler and better here — move the mock
   approve/decline into a single Route Handler under
   `app/api/dev/mock-payment/route.ts` that returns 404 unless
   `PAYMENT_PROVIDER === "mock"`, and have the page post a normal form to it.
   One gate, one file, impossible to forget.

### Dependências

Blocks SEC-01 and SEC-02 (same files). Do SEC-01's runtime gate first, then
this.

### Testes necessários

- Unit: with `PAYMENT_PROVIDER=stripe`, `approveMockPayment` rejects and the
  order's status is unchanged.
- Unit: with `PAYMENT_PROVIDER=stripe`, `GET /checkout/mock/<id>` is 404.
- E2E (mock mode) keeps passing unchanged.

---

## Architecture observations that are *not* problems

Recorded so a future agent doesn't "fix" them:

- **No internal REST/tRPC layer.** Correct for a single deployable; explicitly
  reasoned in `architecture.md` §2. Do not add one.
- **`packages/*` not depending on each other.** Stricter than the documented
  rule; keep it.
- **`getOrderById` having no ownership check.** Deliberate and documented at
  `orders.ts:192-197`: it backs the post-checkout confirmation page, reached
  by an unguessable UUID, the same way an emailed receipt link works. The
  *authenticated* path (`getOrderForUser`) does enforce ownership, and is
  tested. See SEC-08 for the one narrow hardening worth doing.
- **Mock approve/decline calling `fulfillPaidOrder` directly rather than
  posting a fake webhook.** This is the right call: it keeps the fulfilment
  code path byte-identical between mock and Stripe, which is exactly what
  `architecture.md` §5 asks for.
- **Duplicated `EMPTY_CART` constant** in `packages/db/src/queries/cart.ts:30`
  and `apps/web/lib/cart.ts:5`. Two lines; not worth a shared export.
