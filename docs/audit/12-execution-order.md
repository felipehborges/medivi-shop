# 12 — Execution order

A dependency-ordered plan for the agent implementing these fixes. The order is
derived from the **real** dependencies found in the code, not a generic
template — several phases exist specifically because one fix must land before
another to avoid rewriting the same lines twice.

---

## How to use this document

1. Read [`11-improvement-plan.md`](11-improvement-plan.md) first for the full
   catalogue. This file says **in what order** and **why**.
2. Answer the decisions in §0 before starting. Four of them change what the
   code should do, not just how.
3. Work one task at a time, in order, following the existing project rule from
   `CLAUDE.md`: *every task must be validated (test or manual check) before
   moving to the next one*.
4. **Definition of done for every task:**
   - the code change,
   - the tests listed for that finding (they are part of the fix, not a
     follow-up),
   - `pnpm lint && pnpm typecheck && pnpm test && pnpm build` clean,
   - the owning doc updated if the fix changes documented behaviour,
   - a focused commit referencing the finding ID (e.g. `fix(ECM-01): …`).
5. Do **not** batch unrelated findings into one commit. Several fixes touch the
   same files in sequence; keeping them separate is what makes a bisect useful
   if something regresses.
6. Before implementing anything marked **Likely** or **verify first**, run the
   stated verification. Three findings change severity depending on the result.

### Verifications to run before writing any code

| Finding | Command / check | Why it matters |
|---|---|---|
| IMG-01 | Add a banner with an off-allowlist image URL, load `/` | Determines P1 (page throws) vs P3 (broken image) |
| SEC-02 | `/checkout/mock/<processed-order-id>?successUrl=javascript:alert(1)` → click Continue | Determines whether the `javascript:` sink is real |
| SEC-06 | Demote an admin in `psql`, immediately reload `/admin` | Confirms `role` is in the cookie cache |
| PERF-02 | `EXPLAIN ANALYZE` the search predicate | Confirms the trigram index is unused |
| DB-03 | Two concurrent queries against a **pooled** Neon URL | Confirms whether `prepare: false` is required |
| BE-03 | `psql -c "\d product_variant"` | Get the exact unique-constraint name — a wrong name makes `isUniqueViolation` silently return false |
| EDGE-02 | `EMAIL_PROVIDER=resend` + an invalid key, then sign up | Confirms whether a throwing hook fails the signup |

---

## §0 — Decisions required before implementation

These are product/architecture calls, not engineering ones. Each changes what
the correct implementation is. **Get answers before Phase 3.**

| # | Question | Options | Blocks | Audit's recommendation |
|---|---|---|---|---|
| D1 | When an admin archives a product, what happens to carts already holding it? | (a) keep the line, render it as "no longer available", block checkout; (b) delete the `cart_item` rows silently | **ECM-02** | (a) — the customer sees why their cart changed |
| D2 | Does a refund restore stock? | (a) yes, `+qty` with an `inventory_log` row; (b) no, goods are written off | **ECM-05** | (a) — these are physical goods and the refund is admin-initiated. Add `refund` to `inventoryChangeReasonEnum` |
| D3 | On an oversold fulfilment (customer charged, order unfulfillable), what happens? | (a) automatic `provider.refund()`; (b) leave it and flag for manual admin review; (c) both — refund and flag | **ECM-01** | (c) — the money must not sit captured, and an admin must know |
| D4 | Is ISR actually wanted, or should the docs be corrected? | (a) implement ISR + the full revalidation matrix; (b) mark it deferred in `spec.md`/`plan.md`/`architecture.md` | **ARCH-01, PERF-01, PERF-04, CFG-05** | (a) — `spec.md` §8's Lighthouse ≥90 criterion is not reachable without it. But (b) is honest and acceptable if scope is tight |
| D5 | How long does a `pending` order live before it is cancelled? | a number of hours | **ECM-06** | 48 h (Stripe sessions expire at 24 h; leaves a margin) |
| D6 | MinIO/S3 objects: public-read bucket, or presigned GET URLs? | (a) public-read; (b) presigned | **CFG-04, CFG-02** | (a) — product photos are public by nature, and (b) would prevent persisting the URL in `product_image.url` |
| D7 | Data retention periods | analytics events / webhook events / abandoned guest carts | **DB-08, DB-09, Phase 8** | 90 d / 30 d / 60 d |
| D8 | `FeatureFlag` — build the admin toggle, or drop the table? | (a) build; (b) drop + document | **DB-10** | (b) — an empty table implies a feature that doesn't exist; the design note belongs in `plan.md` §21 |
| D9 | Newsletter form — persist signups or be honest that it's a demo? | (a) persist; (b) change the copy | **FE-10** | (b) — a fake success state is a weaker portfolio signal than an honest one |
| D10 | Wishlist → cart (`spec.md` §3.2) — build it or strike it? | (a) build; (b) remove from the spec | **ECM-15** | (a) if cheap (link to the product page for variant choice), else (b) |

---

## Phase 0 — Close the exploitable holes

**Why first:** three defects are exploitable against a running deployment
today and none of them depends on a refactor. They use only existing test
tooling (Vitest + the real Postgres), so they can ship immediately.

**Estimated size:** small. This is the highest value-per-line work in the plan.

| # | Task | Findings | Files | Notes |
|---|---|---|---|---|
| 0.1 | Gate the mock payment path on `PAYMENT_PROVIDER` | **SEC-01** | `lib/actions/mock-checkout.ts`, `app/(storefront)/checkout/mock/[token]/page.tsx` | Guard both actions **and** the page. Verify the E2E suite (mock mode) still passes |
| 0.2 | Bind mock approve/decline to the order's owner | **SEC-01** | same + `lib/cart-owner.ts` | Session `userId` **or** the guest-cart token resolving to `order.cartId`. Both E2E journeys approve their own order, so they should stay green — confirm |
| 0.3 | Stop accepting redirect targets from the client | **SEC-02** | `packages/payments/src/providers/mock.ts`, the mock page, `lib/actions/mock-checkout.ts` | Derive `/order/confirmation/<id>` and `/checkout` server-side; delete the two params from the schema. Also add the reusable `safePath` validator here — BE-09 needs it later |
| 0.4 | Enforce `product.status = 'active'` in the write path | **ECM-02** | `queries/cart.ts` (`addCartItem`, `getCartDetail`), `queries/orders.ts` (`createOrder`), `components/checkout-form.tsx`, `components/cart-line-item.tsx` | Needs **D1**. Add the `unavailable` issue kind and the per-line availability flag |

**Exit criteria:** with `PAYMENT_PROVIDER=stripe`, the mock route 404s and both
actions reject; a non-owner cannot approve in mock mode; a `draft`/`archived`
variant cannot be added to a cart or checked out; both E2E journeys pass.

---

## Phase 1 — Test foundations

**Why here:** every phase after this one lists tests as part of its definition
of done, and two of those tests cannot be written without new tooling. TST-04
comes first because a flaky suite makes every subsequent phase's signal
unreliable.

| # | Task | Findings | Notes |
|---|---|---|---|
| 1.1 | Replace the `Date.now()` unique-id helper with `randomUUID()` | **TST-04** | One implementation exported from `@medivi/db/test`; delete all six copies. Make real-pool cleanup `try/finally`-safe. Verify with a 20× loop |
| 1.2 | Add multi-item / multi-payment / non-active fixtures | **TST-03** | The single highest-leverage change in the audit: ECM-01 and DB-06 become visible under these fixtures |
| 1.3 | Add component-test tooling | **TST-01** | Testing Library + jsdom (or happy-dom); split Vitest into `node`/`dom` projects; establish the action/router/image mocking pattern **once**, in a shared helper |
| 1.4 | Add `@axe-core/playwright` + an accessibility spec | **TST-02** | Scan the eight pages from `plan.md` §16, both colour schemes, plus open drawer/dialog states. Baseline any pre-existing violations rather than disabling rules |
| 1.5 | Seed hero + promo banners | **TST-02, A11Y-01** | `packages/db/src/seed-catalog.ts` inserts none, which is why the carousel has never been scanned — and why the homepage looks unfinished in a demo |

**Exit criteria:** `pnpm test` runs both Vitest projects; 20 consecutive runs
are green; the axe spec runs in CI and goes red when the root `<main>` is
removed.

---

## Phase 2 — Schema and domain foundations

**Why here:** migrations are cheapest while row counts are low, and ARCH-05 is
a hard prerequisite for three Phase-3 fixes. Doing ARCH-05 later means editing
the same four call sites three times.

| # | Task | Findings | Notes |
|---|---|---|---|
| 2.1 | Single order-status transition table | **ARCH-05** | `packages/db/src/domain/order-status.ts` with `canTransition`/`assertTransition`. **Keep** the `WHERE status = …` clauses — they are the concurrency guard, not the readability guard. Table-driven test over all 25 pairs |
| 2.2 | Index migration | **DB-01** | ~12 indexes via the drizzle schema so `drizzle-kit generate` produces the SQL. Prefer composites (`order (user_id, created_at DESC)`). If ECM-07 will use a partial unique index on `order (cart_id) WHERE status='pending'`, add it here instead of a plain index |
| 2.3 | `timestamptz` migration + `TZ=UTC` | **DB-02** | One migration converting every timestamp column; pin `TZ=UTC` in the `Dockerfile` runner and both compose files; make the analytics day-bucket explicit (`AT TIME ZONE 'UTC'`). Run integration tests under a non-UTC `TZ` |
| 2.4 | Payment-row targeting + constraints | **DB-06** | Resolve the specific payment by id; `UNIQUE (provider, provider_ref)`; partial unique index for at most one open payment per order |
| 2.5 | One-default-address index | **DB-04** | `CREATE UNIQUE INDEX … ON address (user_id) WHERE is_default`. Verify the existing demote-then-promote ordering is compatible **inside each transaction** first |

**Exit criteria:** all migrations applied cleanly to a fresh database and to a
seeded one; `EXPLAIN` shows index scans on the four hot queries; the full suite
passes under `TZ=America/Sao_Paulo`.

---

## Phase 3 — Money correctness

**Why here:** this is the core of the audit, and every task depends on Phase 2.
Strictly ordered — each task builds on the previous one's restructuring.

| # | Task | Findings | Depends on | Notes |
|---|---|---|---|---|
| 3.1 | Fix the partial stock decrement | **ECM-01** | 2.1, 1.2 | Throw a sentinel to roll back; re-record idempotency + payment failure in a separate committed transaction; pre-check all lines with `SELECT … FOR UPDATE`. Needs **D3**. Escalate to `logger.error` + Sentry |
| 3.2 | Move validation inside the transaction | **ECM-08** | 3.1 | Do it inside 3.1's restructure — it is the same `db.transaction` block |
| 3.3 | Verify the paid amount and currency | **SEC-12** | 3.1 | Pass `amountCents`/`currency` through; on mismatch return `amount_mismatch`, do **not** mark paid |
| 3.4 | Guard the payment update on order status | **ECM-04** | 2.4, 3.1 | Return `not_pending` without mutating; no confirmation email in that case |
| 3.5 | Reorder the refund flow | **ECM-03** | 2.1, 3.4 | Validate + `refund_pending` + audit row **first**, then the provider, then commit. One predicate. Add a provider idempotency key (extends `PaymentProvider.refund` and both implementations) |
| 3.6 | Restock on refund | **ECM-05** | 3.5, D2 | Migration to add `refund` to `inventoryChangeReasonEnum`; restock + log inside the same transaction |
| 3.7 | Implement `pending → cancelled` | **ECM-06** | 2.1, D5 | `cancelOrder()`; distinguish `session.expired` (terminal) from a retryable decline; handle `payment_intent.payment_failed`, which is currently unmapped; admin Cancel button; an expiry sweeper command |
| 3.8 | Checkout idempotency | **ECM-07** | 2.2, 3.7 | Reuse an existing open order for the cart (preferred) behind the partial unique index; cancel superseded orders |

**Exit criteria:** the five priority tests from `07-testing.md` §TST-03 pass;
a multi-line oversell rolls back completely; a refund on an illegal state never
reaches the provider; an expired session cancels its order; one cart cannot
produce two live orders.

---

## Phase 4 — Validation and backend contracts

**Why here:** independent of Phase 3, but VAL-01 and BE-02 touch every schema
and every action, so doing them after the money work avoids merge churn in
`queries/orders.ts`.

| # | Task | Findings | Notes |
|---|---|---|---|
| 4.1 | Field-length and numeric bounds | **VAL-01, SEC-07** | Use the table in `03-backend.md`; mirror the email-reaching fields as DB `CHECK`s; add `isNumericOutOfRange` (`22003`) to `pg-errors.ts` |
| 4.2 | Fix the price-override coercion | **VAL-02** | Empty/null branch **first** in the union, `.min(1)`; replace the `??` reads with explicit null checks |
| 4.3 | `safeParse` + typed validation failures | **BE-02** | One `validate()` helper; widen result unions; raise `addToCartSchema.quantity.max` or clamp client-side so the two can't diverge |
| 4.4 | Shared `parsePage` / `parsePageSize` | **BE-01, BE-11** | Reuse the storefront's correct parser on all four admin pages; clamp `pageSize` in the query layer too |
| 4.5 | Typed SKU conflicts | **BE-03** | Verify the constraint name in `psql` first; replace `VariantManager`'s blanket catch |
| 4.6 | Block deleting a product's last variant | **BE-04** | Query guard + disabled UI + a defensive "unavailable" render instead of `null` |
| 4.7 | Preserve the default address on edit | **BE-05** | Pairs with 2.5's index |
| 4.8 | Fail-open rate limiter | **EDGE-03** | Catch inside `UpstashRateLimiter`; add a `degraded` flag and a `warn` log; add a timeout |
| 4.9 | Non-forgeable rate-limit identity | **SEC-04** | `TRUSTED_PROXY_HOPS`; parse XFF from the right; key checkout on the session id / guest-cart token; never key on `"unknown"` |

**Exit criteria:** an over-long field is rejected at the boundary; every action
returns a typed validation failure instead of throwing; `/admin/*?page=abc`
returns 200; a forged `X-Forwarded-For` does not create a new rate-limit bucket.

---

## Phase 5 — Deployment correctness

**Why here:** these three make the **self-host target actually work**. CFG-02
must come first because IMG-01 and SEC-03 both consume the hostname list it
establishes.

| # | Task | Findings | Notes |
|---|---|---|---|
| 5.1 | Split internal vs public storage URLs | **CFG-02** | Add `S3_PUBLIC_URL`; fix `delete`'s key extraction to match; derive `next.config.ts` `remotePatterns` from the same source |
| 5.2 | Create and configure the MinIO bucket | **CFG-04** | A `minio/mc` init service in both compose files (`mc mb` + `mc anonymous set download`); typed storage errors instead of a 500. Needs **D6** |
| 5.3 | Storage provider tests | **TST-06** | `packages/storage` currently has no tests **and no `test` script`** — the gap that let CFG-02 ship |
| 5.4 | Fix build-time vs runtime env | **CFG-01** | Preferred: drop `baseURL` from `createAuthClient` so it uses the current origin. Add a build-time/runtime column to `runbook.md`'s env table |
| 5.5 | Validate admin image hosts | **IMG-01** | Zod `.refine` against the shared allowlist + a fail-soft image wrapper. Run the §0 verification first |
| 5.6 | Health check + compose healthcheck | **CFG-03** | `select 1`, no detail in the response; `node -e fetch` healthcheck (curl/wget are absent from `node:24-alpine`) |
| 5.7 | Security headers | **SEC-03** | Static headers + `poweredByHeader: false` first; then a nonce-based CSP, report-only for one deploy. Widening the proxy matcher affects every route — re-run the full E2E suite |
| 5.8 | Env coherence validation | **ARCH-02** | `.superRefine` for the four conditional groups so misconfiguration fails at boot; remove the `drizzle.config.ts` fallback; make `load-env` a no-op when the var is set |

**Exit criteria:** a fresh `docker compose -f docker/docker-compose.prod.yml up
--build` at a non-localhost host serves the storefront, allows sign-in, and
allows an admin image upload that renders in the browser — following only
`runbook.md`, with no undocumented steps (`spec.md` §8's criterion).

---

## Phase 6 — Caching and performance

**Why here:** ARCH-01 depends on Phase 5's hostname/CSP work (the `img-src`
list) and must land **with** PERF-01 and PERF-04 or the cart badge breaks.
Needs **D4**.

| # | Task | Findings | Notes |
|---|---|---|---|
| 6.1 | Deduplicate + slim the header queries | **PERF-04** | `getCartItemCount` for the badge; drawer contents on open; React `cache()` for the duplicated `listCategoryTree`. **This alone is a worthwhile standalone change** even if D4 says "defer ISR" |
| 6.2 | Suspense-isolate the session/cart islands | **ARCH-01** | The prerequisite for any static rendering |
| 6.3 | ISR + cache tags on the four storefront routes | **ARCH-01** | `unstable_cache`/`cacheTag`, plus a bounded `generateStaticParams` for products |
| 6.4 | The full revalidation matrix | **ARCH-01** | The table in `01-architecture.md`. **Every** admin mutation, plus the fulfilment path (stock changed) |
| 6.5 | Replace `revalidatePath("/", "layout")` | **PERF-01** | Client-side badge updates; targeted tags elsewhere; **never** revalidate from the webhook for UI reasons |
| 6.6 | Fix the trigram search path | **PERF-02** | `<%` with an explicit threshold; fallback only when FTS returns nothing; merge the count with `count(*) OVER ()`. The three existing search tests are the behavioural contract |
| 6.7 | Parallelise `getOrderById` | **PERF-05** | `Promise.all` after the first query; add a cheap ownership pre-check in `getOrderForUser` |

If **D4 = defer**: do 6.1, 6.6, 6.7 only, and update `spec.md` §10/§11,
`plan.md` §14 and `architecture.md` §8 to state that ISR was not built.

**Exit criteria:** storefront routes are no longer dynamic; an admin price
change is visible immediately; the cart badge still updates; a search query
uses the trigram index (`EXPLAIN`).

---

## Phase 7 — Frontend and UX

**Why here:** needs Phase 1's component-test tooling, Phase 3's new order
states (ECM-10 renders them), and Phase 6's revalidation scope (FE-02's
optimistic UI would otherwise be clobbered).

| # | Task | Findings | Notes |
|---|---|---|---|
| 7.1 | Error handling at every client action call site | **FE-01** | Re-throw redirect errors (**verify the Next 16 helper — `unstable_rethrow` vs `isRedirectError`**); cancel the order on provider failure (needs 3.7); apply to all 11 unguarded call sites |
| 7.2 | Honour `redirectTo` safely | **BE-09, FE-13** | Use 0.3's `safePath` validator. Redirect on session expiry mid-checkout, or always render the email field |
| 7.3 | Exhaustive order-status rendering | **ECM-10** | A `switch` so TypeScript enforces coverage; gate the analytics beacon on `paid`/`fulfilled`; add a terminal poller state |
| 7.4 | Cart quantity as a server-computed delta + optimistic UI | **FE-02** | After 6.5 |
| 7.5 | Search history + header query state | **FE-03, FE-05** | `replace` for debounce, `push` for submit; pass `initialQuery` |
| 7.6 | Accessible carousel | **A11Y-01** | Pause control, hover/focus pause, stop on interaction, `prefers-reduced-motion`, `aria-live`. Verified by 1.4's axe spec + a component test |
| 7.7 | SEO metadata + sitemap | **SEO-01, SEC-08** | Paginate the sitemap; `metadataBase` + canonical + OG/Twitter; `noindex` on filtered catalog URLs and the confirmation page; extend the robots disallow list; category **name** not slug |
| 7.8 | Transactional cart merge with user feedback | **ECM-09, ECM-11** | One transaction; return a clamped/dropped summary and surface it as a toast; re-point open orders at the surviving cart |
| 7.9 | Remaining UX polish | **FE-06, FE-07, FE-08, FE-09, FE-11, FE-12** | Page clamping and a filters-specific empty state; confirmation dialogs on the four destructive actions; `not_found` results; gallery/dialog ARIA; `<time dateTime>`; a total-order variant comparator |
| 7.10 | Newsletter honesty | **FE-10** | Needs **D9** |

**Exit criteria:** no client action call site can fail silently; every
`OrderStatus` renders a correct message; the axe spec is green including the
carousel; sitemap contains every product.

---

## Phase 8 — Data lifecycle and analytics integrity

**Why here:** depends on Phase 2's indexes. Needs **D7**.

| # | Task | Findings | Notes |
|---|---|---|---|
| 8.1 | Rate-limit and harden the analytics endpoint | **SEC-05** | Limit by session cookie; move `checkout_completed` server-side (verify the order is `paid`) and narrow the accepted enum to `page_view`/`search_performed` |
| 8.2 | Beacon Strict-Mode guard | **FE-04** | Same `firedRef` pattern as `CheckoutCompletedBeacon` |
| 8.3 | Retention + maintenance command | **DB-08, DB-09** | One `pnpm --filter @medivi/db maintenance` covering: expire `pending` orders (3.7), delete guest carts > 60 d, `analytics_event` > 90 d, `processed_webhook_event` > 30 d. Document the periods |
| 8.4 | Idempotent, transactional seed | **DB-07** | Wrap in a transaction; `onConflictDoNothing` or a `--reset` flag reusing the E2E TRUNCATE list; document the admin-promotion SQL in `runbook.md` |

---

## Phase 9 — Remaining security hardening

Independent of everything above; grouped so one security review covers them.

| # | Task | Findings |
|---|---|---|
| 9.1 | Bypass the cookie cache for `requireAdmin`; revoke sessions on role change | **SEC-06** (run the §0 verification first) |
| 9.2 | Prevent demoting the last admin | **EDGE-01** |
| 9.3 | Wrap the three auth email hooks in `try/catch` + log | **EDGE-02** |
| 9.4 | Validate `ctaHref` / `imageUrl` schemes | **SEC-09** |
| 9.5 | Escape or eliminate `ilike` wildcards in the material filter | **SEC-10** |
| 9.6 | Require compose secrets; bind dev services to loopback | **SEC-11** |
| 9.7 | Enable Better Auth rate limiting in non-production | **SEC-13** |
| 9.8 | Map auth error codes instead of echoing library messages | **SEC-14** |
| 9.9 | Derive the stored `ContentType` from the sniffed image type | **SEC-15** |

---

## Phase 10 — Tooling, CI and documentation reconciliation

**Why last:** CFG-05's Lighthouse gate will fail until Phase 6 lands, so
enabling it earlier just produces a red build with nothing to do about it.

| # | Task | Findings | Notes |
|---|---|---|---|
| 10.1 | Lighthouse + a11y in CI; run E2E on PRs | **CFG-05, TST-05** | Warn-level assertions for one run to establish the baseline, then error |
| 10.2 | Fill the E2E gaps | **TST-05** | Wishlist, decline path, out-of-stock/price-changed at checkout, guest lookup, address book, password reset, a mobile project; export seed slugs as constants |
| 10.3 | CI environment gaps | **TST-07, CFG-11** | Set `STORAGE_PROVIDER` (and a MinIO service for the E2E job); quote the `.env` heredoc; scope `cancel-in-progress` to PRs; add a Firefox project |
| 10.4 | Prettier | **CFG-06** | Initial reformat as its own commit |
| 10.5 | Type-aware lint | **CFG-07** | `recommendedTypeChecked` + `switch-exhaustiveness-check`; measure the CI cost and split into a separate job if material |
| 10.6 | Dependency hygiene | **CFG-08, CFG-09** | Remove or use `axe-core`; fix `packages/ui`'s peer deps; add the audit allowlist; consider replacing `image-size` with `sharp` |
| 10.7 | Docker/DB client tuning | **CFG-12, DB-03** | `HEALTHCHECK` (from 5.6), pool options, `prepare: false`, the dev `globalThis` guard |
| 10.8 | Route group split | **ARCH-04** | `(auth)` vs `(account)` |
| 10.9 | Remaining backend cleanups | **BE-06, BE-07, BE-08, BE-10, ECM-12, ECM-13** | Build or delete the variant-edit path; typed shipping-method result; analytics failure metric; read currency from the data |
| 10.10 | Resolve the dead FeatureFlag table and wishlist→cart | **DB-10, ECM-15** | Needs **D8**, **D10** |
| 10.11 | **Reconcile the documentation** | **ARCH-03, CFG-10** | Update `spec.md`, `plan.md`, `architecture.md`, `runbook.md` and `tasks.md` so every claim matches the code. Fix the `packages/db/drizzle/` path in the rollback section. Mark anything still deferred **explicitly**, in the style of `tasks.md` 2.2 |

---

## Phase 11 — Final validation

Not a code phase — the acceptance gate for the whole plan. Re-verify the
project's own success criteria from `spec.md` §8, which is what this audit was
ultimately measuring against:

| Criterion | How to verify |
|---|---|
| Landing → confirmed order via the mock provider, no manual steps, < 2 min | The E2E purchase journey, timed |
| Every state-changing admin action writes an audit row | The existing per-module tests **plus** new ones for the refund-failure and oversell paths (X-10) |
| Stock never goes negative under concurrent load | `orders-concurrency.test.ts`, extended to multi-line orders (3.1) |
| Lighthouse ≥ 90 on `/`, `/catalog`, `/product/[slug]` (mobile) | CI Lighthouse job at error-level assertions (10.1) |
| Tests cover cart math, checkout/webhook idempotency, stock concurrency, auth, and the full purchase journey E2E | The suite after Phases 1–10 |
| Deploys from a clean checkout with documented commands and **no undocumented manual steps** | A fresh clone → `runbook.md` self-host path end to end, on a machine that has never run this project |

Plus a regression sweep:

```bash
pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @medivi/web test:e2e
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

and a re-read of this audit's P0/P1 list, confirming each finding's stated
reproduction no longer reproduces.

---

## Quick-reference: what blocks what

```
D1 ─────────────────────────► ECM-02 (0.4)
D3 ─────────────────────────► ECM-01 (3.1)
D2 ─────────────────────────► ECM-05 (3.6)
D4 ─────────────────────────► ARCH-01 (6.2–6.4)
D5 ─────────────────────────► ECM-06 (3.7)
D6 ─────────────────────────► CFG-04 (5.2)

SEC-01 (0.1) ──► SEC-02 (0.3) ──► BE-09 (7.2)      [safePath validator]
                            └───► ARCH-06 (10.x)

TST-04 (1.1) ──► everything downstream              [flake-free signal]
TST-03 (1.2) ──► ECM-01 (3.1), DB-06 (2.4)          [multi-item fixtures]
TST-01 (1.3) ──► FE-01, FE-02, FE-13, ECM-10, A11Y-01
TST-02 (1.4) ──► A11Y-01 (7.6), CFG-05 (10.1)

ARCH-05 (2.1) ─► ECM-03 (3.5), ECM-04 (3.4), ECM-06 (3.7)
DB-01  (2.2) ──► ECM-07 (3.8), PERF-06, SEC-05/DB-09 (8.x)
DB-02  (2.3) ──► FE-11 (7.9)
DB-06  (2.4) ──► ECM-04 (3.4) ──► ECM-03 (3.5)
DB-04  (2.5) ──► BE-05 (4.7)

ECM-01 (3.1) ──► ECM-08 (3.2), SEC-12 (3.3), ECM-05 (3.6)
ECM-06 (3.7) ──► FE-01 (7.1) step 2, ECM-07 (3.8), ECM-10 (7.3)

CFG-02 (5.1) ──► IMG-01 (5.5), SEC-03 (5.7)         [shared hostname list]
CFG-04 (5.2) ──► CFG-02 (5.1) is useless without it

PERF-04 (6.1) ─► ARCH-01 (6.2) ──► PERF-01 (6.5) ──► FE-02 (7.4)

Phase 6 ───────► CFG-05 (10.1)                      [Lighthouse would fail earlier]
```
