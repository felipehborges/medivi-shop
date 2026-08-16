# 11 — Improvement plan (consolidated)

Every finding, ordered by severity. This file is the **index of record**;
full detail (reproduction, impact, exact recommendation, required tests) lives
in the per-area document linked from each row.

**103 findings: 4 × P0 · 15 × P1 · 37 × P2 · 47 × P3.**
Two entries (`PERF-03`, `SEC-07`) are cross-references to findings tracked
under another ID and are not counted twice.

For execution sequencing, read [`12-execution-order.md`](12-execution-order.md).

---

## Part 1 — Cross-cutting analysis (second pass)

Problems that only appear at the seams between components. This pass was run
after each area was audited individually.

### X-1 The frontend assumes Server Actions never throw; the backend throws in nine places

**Findings: FE-01, BE-02, EDGE-03**

`plan.md` §20 defines the contract — *"validation failures are typed, expected
results (not thrown exceptions)"*. The backend honours it for **expected
business failures** and violates it for everything else: `schema.parse()`
throws (BE-02), provider calls throw (FE-01), the rate limiter throws
(EDGE-03). The frontend was written against the documented contract, so 11 of
14 client-side action call sites have no `try/catch`.

The result is a systematic class of silent failures, worst at checkout. Neither
layer is individually wrong — they disagree about the contract.

**Fix as one change:** adopt `safeParse` + a `ValidationFailure` branch
(BE-02), make providers fail into typed results, and add `try/catch` to every
client call site. Doing these separately leaves the mismatch in place.

### X-2 The backend assumes product status gates purchase; the database enforces nothing

**Findings: ECM-02, BE-04, DB-05**

Three "invariants" exist only as prose:

| Invariant | Stated in | Enforced by |
|---|---|---|
| Only `active` products are purchasable | implied by every read query | **nothing** in the write path (ECM-02) |
| Every product has ≥1 variant | `architecture.md` §3 + a schema comment | creation only; deletion can violate it (BE-04, DB-05) |
| Exactly one default address per user | `tasks.md` 6.2 | two of three code paths (BE-05, DB-04) |

Each is a case of the same pattern: a rule the **reader** enforces, the
**writer** doesn't, and the **schema** can't. Fix by pushing each rule down one
level — into the write path at minimum, into a constraint where possible.

### X-3 The tests assume single-item orders; the application allows many

**Findings: ECM-01, DB-06, TST-03**

Every order fixture in the test suite creates **one** line item and **one**
payment row. The two most serious correctness defects in this audit —
partial stock decrement (ECM-01) and all-payments updates (DB-06) — are both
invisible under that fixture and both trivially visible under a two-item one.

This is the highest-leverage testing change in the audit: **fix the fixtures,
and the bugs surface on their own.**

### X-4 The documentation describes a caching architecture; the code has none, and the invalidation calls needed to make it correct are absent

**Findings: ARCH-01, PERF-01, PERF-03**

`spec.md` §10/§11, `plan.md` §14 and `architecture.md` §8 all describe ISR with
on-demand revalidation. There is none. Worse, the *invalidation* half is
missing too — no admin mutation revalidates a storefront path.

So the obvious performance fix ("add ISR") converts a performance problem into
a **data-correctness** problem: the storefront would serve stale prices and
stock indefinitely. Meanwhile `revalidatePath("/", "layout")` on every cart
click (PERF-01) would evict the whole cache for every visitor.

**These three must be fixed as one unit, or not at all.**

### X-5 A payment path exists that bypasses the project's single non-negotiable rule

**Findings: SEC-01, SEC-02, ARCH-06**

`CLAUDE.md`: *"Payment status only ever changes via a verified webhook … never
from a client redirect/return URL."* The Stripe path honours this exactly.
The **mock** path — an unauthenticated Server Action, live in every build
regardless of `PAYMENT_PROVIDER` — does not.

The gap is architectural: `PAYMENT_PROVIDER` gates the provider *object*
(`lib/payments.ts`), while the mock provider also owns a *route* and two
*actions* in the host app that no env var touches. The abstraction leaked in a
direction the interface can't express.

### X-6 Types agree across layers; runtime values don't

**Findings: CFG-01, CFG-02, DB-02**

There is no frontend/backend type divergence — the monorepo shares types
directly and the Zod schemas are genuinely imported by both sides. That part
is done well.

The divergence is in *values* that differ between build time and run time, or
between the server's network and the browser's:

- `NEXT_PUBLIC_APP_URL` is runtime on the server, **build-time** in the client
  bundle (CFG-01) — so server-generated links are right and client auth calls
  point at `localhost:3000`.
- `S3_ENDPOINT` is the server's view of MinIO; the same string is persisted
  and handed to browsers (CFG-02).
- Timestamps are zone-less and interpreted in whichever process's `TZ` touched
  them last (DB-02).

Each is "one value, two meanings". The fix in each case is to split the value,
not to synchronise it.

### X-7 Error handling is inconsistent across layers, and the inconsistency is invisible

**Findings: FE-01, EDGE-02, EDGE-03, BE-08**

Four different failure policies coexist with no stated rule:

| Layer | Policy | Example |
|---|---|---|
| Webhook route | defensive, always 2xx/4xx | `api/webhooks/stripe/route.ts` ✅ documented |
| Order-confirmation email | catch + log, never propagate | `lib/order-confirmation-email.ts:31` ✅ |
| **Auth emails** | **no catch** | `lib/auth.ts:37-43` ❌ EDGE-02 |
| **Rate limiter** | **no catch, fails closed** | `lib/rate-limit.ts` ❌ EDGE-03 |
| Storage upload | no catch | `lib/actions/admin-products.ts:110` ⚠️ |
| Server Actions | let it throw | everywhere ⚠️ FE-01 |

`plan.md` §20 states the *philosophy* ("validate at the boundary, let
unexpected errors throw") but never says which side effects are best-effort.
**Write the rule down**, then apply it: *external side effects that are not
required for correctness (email, analytics, rate limiting, revalidation) must
fail open and log; those that are (payment, database) must fail loudly.*

### X-8 Analytics is unauthenticated, unindexed, unbounded and forgeable — and feeds a decision-support dashboard

**Findings: SEC-05, DB-01, DB-09, FE-04**

Individually each is P2/P3. Together: an anonymous actor can insert unlimited
rows of arbitrary funnel events (SEC-05) into a table with no indexes (DB-01)
and no retention (DB-09), which the admin dashboard then scans in full to
compute a conversion rate (`conversionFunnel`). Every injected row makes the
dashboard slower and its numbers less true, permanently.

Fix all four together or the amplification remains.

### X-9 Rate limiting is the only brake on unauthenticated writes, and it doesn't work

**Findings: SEC-04, ECM-07, VAL-01, EDGE-03**

Guests can create `cart`, `cart_item`, `order`, `order_item`, `payment` and
`analytics_event` rows with no account. The stated control is a 10/min
checkout limiter — which is keyed on a spoofable header (SEC-04), has no
per-cart idempotency behind it (ECM-07), no field-length caps (VAL-01), and
takes checkout down entirely when its backend is unreachable (EDGE-03).

The individual fixes are small; the combination is what matters.

### X-10 The audit log is the compliance mechanism, and the two paths that most need it don't write to it

**Findings: ECM-03, ECM-01**

`spec.md` §8 makes it a success criterion: *"All state-changing admin actions
produce an audit log entry."* Verified true for all 20 admin CRUD actions —
each writes its row inside the same transaction as the mutation. Good.

The exceptions are the two money paths:
- A refund that succeeds at Stripe but fails the DB transition (ECM-03) leaves
  **no** audit row — the one case where a record matters most.
- An oversold fulfilment (ECM-01) charges a customer and leaves the order
  unfulfillable, writing only a `logger.info` line.

---

## Part 2 — P0 (Critical)

### SEC-01 — Mock payment approval is an unauthenticated, always-live Server Action
- **Área:** Security / Payments · **Detalhe:** [`06-security.md`](06-security.md#sec-01-mock-payment-approval-is-an-unauthenticated-server-action-that-is-live-in-every-build)
- **Arquivos:** `apps/web/lib/actions/mock-checkout.ts:22,39` · `apps/web/app/(storefront)/checkout/mock/[token]/page.tsx` · `apps/web/components/mock-checkout-actions.tsx`
- **Problema:** No auth, no ownership check, and no `PAYMENT_PROVIDER` gate. Anyone holding an order UUID can mark it **paid** — even in a real-Stripe deployment. Complete bypass of `CLAUDE.md`'s single non-negotiable rule.
- **Solução:** (1) `if (env.PAYMENT_PROVIDER !== "mock")` guard in both actions and the page; (2) bind the action to the order's owner via session `userId` or the guest-cart token; (3) derive redirect URLs server-side (SEC-02); (4) move the whole path behind one gated Route Handler (ARCH-06).
- **Dependências:** fix with SEC-02 (same files); ARCH-06 afterwards. E2E runs in mock mode and must stay green.
- **Testes:** with `PAYMENT_PROVIDER=stripe`, both actions reject and mutate nothing, and the page 404s; in mock mode a non-owner is rejected and the owner succeeds; existing E2E passes.

### ECM-01 — `fulfillPaidOrder` commits a partial stock decrement on the oversold path
- **Área:** E-commerce · **Detalhe:** [`04-ecommerce.md`](04-ecommerce.md#ecm-01-fulfillpaidorder-commits-a-partial-stock-decrement-on-the-oversold-path)
- **Arquivos:** `packages/db/src/queries/orders.ts:311-369` (esp. 345)
- **Problema:** Drizzle commits when the callback *returns*. The oversold branch returns after some lines have already decremented stock and written inventory-log rows. On a multi-line order: stock leaks permanently, the inventory log records a sale that didn't happen, the customer is charged (Stripe captured), the order stays `pending`, and the confirmation page tells them they were **not** charged.
- **Solução:** throw a sentinel so the transaction rolls back; re-record the idempotency row and the payment failure in a separate committed transaction; pre-check all lines with `SELECT … FOR UPDATE` before mutating any; escalate `oversold` to `logger.error` + Sentry + an automatic refund or an admin-visible review state.
- **Dependências:** after ARCH-05 (single transition table). Shares the inventory-log helper with ECM-05.
- **Testes:** the five listed in `04-ecommerce.md` — multi-line oversell (short line last **and** first), idempotency after oversell, happy multi-line, and a multi-line real-connection concurrency test.

### ECM-02 — `draft` and `archived` products can be added to cart and purchased
- **Área:** E-commerce · **Detalhe:** [`04-ecommerce.md`](04-ecommerce.md#ecm-02-draft-and-archived-products-can-be-added-to-cart-and-purchased)
- **Arquivos:** `packages/db/src/queries/cart.ts:123-172, 80-98` · `packages/db/src/queries/orders.ts:57-97`
- **Problema:** `product.status` gates every read path and no write path. Archiving is the project's only delete mechanism, so a withdrawn product stays purchasable for anyone who already has it in a cart — and a `draft` product's auto-created variant is purchasable at its placeholder price (often 0).
- **Solução:** join `product` and require `status = 'active'` in `addCartItem`; add an `unavailable` issue kind to `createOrder`; surface unavailable lines in `getCartDetail` (do not hide them); decide and document what archiving does to existing carts.
- **Dependências:** shares the `StockOrPriceIssue` union and the `CheckoutForm` rendering with the existing issues. The archive-behaviour choice is a **product decision** — get it answered first.
- **Testes:** draft/archived variant rejected at add; archived product blocks checkout with an itemised issue; `getCartDetail` marks the line unavailable and excludes it from the subtotal; E2E archive-while-in-cart.

### DB-06 — Payment status updates target every payment row for an order
- **Área:** Database / Payments · **Detalhe:** [`05-database.md`](05-database.md#db-06-payment-status-updates-target-every-payment-row-for-an-order)
- **Arquivos:** `packages/db/src/queries/orders.ts:346, 353, 386, 424` · `packages/db/src/schema/payment.ts:19-23`
- **Problema:** the schema documents `payment` as 1:many for future partial capture/refund history, but every write is `WHERE order_id = …` with no further qualifier. The moment a second row exists (retry — the feature `spec.md` §7 describes — or partial capture), one webhook marks all payments succeeded and one refund marks all refunded. Financial ledger corruption.
- **Solução:** resolve the specific payment row first and update by `id`; add `UNIQUE (provider, provider_ref)`; add a partial unique index allowing at most one open payment per order; consider a separate `refund` table.
- **Dependências:** do with ECM-04 (same statements), before ECM-03.
- **Testes:** two payment rows → exactly the open one is confirmed; duplicate `(provider, provider_ref)` rejected; refund touches exactly one row.

---

## Part 3 — P1 (High)

| ID | Problema | Arquivos | Solução (resumo) | Depende de | Testes |
|---|---|---|---|---|---|
| **ARCH-01** | ISR + on-demand revalidation documented in three files, implemented nowhere; the root layout's cookie reads force every route dynamic; no admin mutation revalidates a storefront path. [detalhe](01-architecture.md#arch-01-isr-and-on-demand-revalidation-are-documented-everywhere-and-implemented-nowhere) | `app/layout.tsx:58`, `components/site-header.tsx:15-19`, all `app/**/page.tsx`, all `lib/actions/admin-*.ts` | Suspense-isolate the session/cart parts of the header; add ISR + cache tags to the four storefront routes; add the full revalidation matrix to every admin mutation; **or** update the three docs to say ISR was deferred | must land with PERF-01 and PERF-04 | build output shows non-dynamic routes; price update is visible without waiting for the window; cart badge still updates |
| **ARCH-06** | The mock provider owns a route + two actions that `PAYMENT_PROVIDER` cannot deactivate. [detalhe](01-architecture.md#arch-06-the-mock-payment-providers-surface-area-is-not-gated-by-payment_provider) | `lib/payments.ts:8-20`, `checkout/mock/[token]/page.tsx`, `lib/actions/mock-checkout.ts` | Runtime gate first (SEC-01); then move approve/decline into one Route Handler that 404s unless mock | after SEC-01 | provider-gated 404/reject tests |
| **CFG-01** | `NEXT_PUBLIC_APP_URL` is inlined at Docker build time as `http://localhost:3000`; `auth-client.ts` hard-codes it as Better Auth's `baseURL`, so **all client auth calls break** on any self-host deploy. [detalhe](10-dependencies-and-config.md#cfg-01-next_public_app_url-is-frozen-to-httplocalhost3000-in-the-docker-image) | `Dockerfile:34`, `docker/docker-compose.prod.yml:26`, `lib/auth-client.ts:6`, `docs/runbook.md:15` | Preferred: omit `baseURL` so the client uses the current origin. Alternative: pass it as a Docker build arg and document that changing it needs a rebuild. Add a build-time/runtime column to the runbook's env table | none | grep the built client chunks for `localhost:3000`; E2E sign-in against a non-3000 host |
| **CFG-02** | Self-host image URLs are built from the **server-side** `S3_ENDPOINT` (`http://minio:9000`) — unresolvable from the browser, MinIO publishes no port, and the host isn't in `remotePatterns`. [detalhe](10-dependencies-and-config.md#cfg-02-self-host-product-image-urls-point-at-the-internal-minio9000-hostname) | `packages/storage/src/providers/s3.ts:53`, `docker/docker-compose.prod.yml:34,71-84`, `next.config.ts:14-19` | Add `S3_PUBLIC_URL`, separate internal endpoint from public base, fix `delete`'s key extraction to match, derive `remotePatterns` from the same shared hostname list | CFG-04 must land with it | `packages/storage` unit tests (TST-06); `curl` the returned URL from outside the Docker network |
| **DB-01** | No index on `order.user_id/status/created_at/cart_id`, `payment.order_id`, `address.user_id`, `analytics_event.*`, `audit_log.*`, `inventory_log.variant_id`. `payment.order_id` seq-scans on **every order read and every fulfilment**; unindexed `order.cart_id` FK means **every sign-in scans `order`**. [detalhe](05-database.md#db-01-missing-indexes-on-every-hot-order--payment--analytics--audit-access-path) | all `packages/db/src/schema/*.ts`; one new migration | Add ~12 indexes via the drizzle schema (prefer composites); note the `CONCURRENTLY` caveat in the runbook | ECM-07 wants a partial unique index on `order (cart_id)` — combine | `EXPLAIN` plan assertions on the four hot queries |
| **ECM-03** | Refund calls the payment provider **before** validating the order state machine, using a *different* predicate than the DB layer. A failure after the provider call leaves money refunded at Stripe with the order still `paid`, **no audit row**, and a retry that refunds again. [detalhe](04-ecommerce.md#ecm-03-refund-calls-the-payment-provider-before-validating-the-order-state-machine) | `lib/actions/orders.ts:29-46`, `queries/orders.ts:416-434` | Validate + transition to `refund_pending` in a transaction first, then call the provider, then commit `refunded`; one predicate only; add a provider idempotency key; store the refund reference | after ARCH-05 and ECM-04; extends `PaymentProvider.refund` | provider never called for an illegal state; provider failure leaves an audit row; concurrent refunds → one provider call |
| **FE-01** | `checkoutAction` is awaited with no `try/catch`; five throw paths produce **no user-visible error** at the Pay button, while orphan `pending` orders accumulate. [detalhe](02-frontend.md#fe-01-checkoutaction-is-called-with-no-error-handling--a-thrown-error-is-silently-swallowed) | `components/checkout-form.tsx:43-61` | `try/catch` that re-throws redirect errors and renders a recovery message; cancel the just-created order on provider failure; apply the same shape to the other 10 unguarded client call sites | step 2 needs ECM-06; pairs with BE-02 | component tests: rejecting action renders an alert; redirect errors propagate |
| **IMG-01** | An admin-entered banner/category image URL on a non-allowlisted host is passed to `next/image` and **breaks the landing page**. [detalhe](02-frontend.md#img-01-an-admin-entered-image-url-on-a-non-allowlisted-host-breaks-the-page-that-renders-it) | `lib/schemas/banner.ts:6`, `lib/schemas/category.ts:10`, `components/hero-carousel.tsx:34`, `components/featured-categories.tsx:23`, `next.config.ts:8-26` | Validate the host at the Zod boundary against a shared allowlist; add a fail-soft image wrapper; prefer uploads over free-text URLs | after CFG-02 (shared hostname list) | schema rejects off-allowlist hosts; a bad row in the DB doesn't break `/` |
| **PERF-01** | `revalidatePath("/", "layout")` — the broadest invalidation Next offers — runs on every cart mutation **and every webhook delivery**. [detalhe](08-performance.md#perf-01-revalidatepath-layout-invalidates-the-entire-site-on-every-cart-mutation-and-every-payment) | `lib/actions/cart.ts:33,58,70,81`, `lib/actions/mock-checkout.ts:34`, `api/webhooks/stripe/route.ts:49` | Update the cart badge client-side instead; replace the rest with targeted cache tags; never revalidate from the webhook for UI reasons | **must land with ARCH-01** | badge updates without full navigation; spy asserts no layout revalidation; product stock visible after payment |
| **SEC-02** | Open redirect (and a probable `javascript:` sink) — `successUrl`/`cancelUrl` round-trip through the URL and reach `redirect()` and `<Link href>` validated only by `z.string().url()`. [detalhe](06-security.md#sec-02-open-redirect-and-a-probable-javascript-sink-through-the-mock-checkout-redirect-parameters) | `packages/payments/src/providers/mock.ts:20-24`, `checkout/mock/[token]/page.tsx:19-24,49,53`, `lib/actions/mock-checkout.ts:14,36,49` | Stop accepting redirect targets from the client — derive both server-side from the order id. Where a caller-supplied target is unavoidable (BE-09), use a strict same-origin **path** validator | same files as SEC-01 | validator rejects `https://evil`, `//evil`, `javascript:`; purchase E2E still lands correctly |
| **SEC-03** | No security headers at all — no CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS or `nosniff`, despite `spec.md` §12. The admin panel is framable and every destructive button is one-click. [detalhe](06-security.md#sec-03-no-security-headers-are-set-anywhere) | `next.config.ts` (no `headers()`), `proxy.ts` | Ship the four static headers + `poweredByHeader: false` first; then a nonce-based CSP (widen the proxy matcher, roll out report-only first); gate HSTS on an `https://` app URL | `img-src` list depends on CFG-02/IMG-01; matcher change re-runs all E2E | header presence assertions; zero CSP violations across the purchase + admin journeys |
| **SEC-04** | Rate limiting is keyed on `X-Forwarded-For`'s **first** entry — client-controlled. Checkout's 10/min is bypassable with a random header; with no proxy, everyone shares one `"unknown"` bucket (a trivial DoS). [detalhe](06-security.md#sec-04-rate-limiting-is-keyed-on-a-client-controlled-header) | `lib/actions/checkout.ts:22-25`, `api/webhooks/stripe/route.ts:19` | Add `TRUSTED_PROXY_HOPS`, parse XFF from the right; prefer platform headers; key checkout on the **session id / guest-cart token** rather than IP; never key on `"unknown"` | none; adds one env var to document | XFF parsing unit tests; same session shares one bucket regardless of forged headers |
| **TST-01** | No component tests exist, and the tooling for them isn't installed — despite `plan.md` §16. Every frontend finding in this audit lives in an untested component. [detalhe](07-testing.md#tst-01-there-are-no-component-tests-and-the-tooling-for-them-does-not-exist) | `apps/web/vitest.config.ts:7-11`, `apps/web/package.json` | Add Testing Library + jsdom; split Vitest into `node`/`dom` projects; establish the action/router/image mocking pattern once; write the eight highest-value component tests | **land before FE-01, FE-02, FE-13, ECM-10, A11Y-01**, which all specify component tests as verification | the tests themselves |
| **TST-02** | `axe-core` is installed and never executed; `spec.md` §9's CI a11y gate does not exist. The Phase 10.2 scan was a one-off, and it never saw the hero carousel because the seed creates no banners. [detalhe](07-testing.md#tst-02-axe-core-is-installed-but-never-executed-there-is-no-accessibility-gate) | `apps/web/package.json:43`, `apps/web/e2e/`, `.github/workflows/ci.yml` | Add `@axe-core/playwright`; scan the eight pages `plan.md` §16 names, in both themes, including open drawers/dialogs; seed hero + promo banners; run on PRs; baseline rather than gate if pre-existing violations surface | land before A11Y-01 so the fix is verified | CI goes red when the root `<main>` is removed |
| **TST-03** | Every P0 in this audit sits in a code path with no covering test — the fixtures are all single-item, single-payment, `status: "active"`. [detalhe](07-testing.md#tst-03-the-critical-paths-that-this-audit-found-broken-are-the-ones-with-no-tests) | `packages/db/src/queries/orders.test.ts`, `cart.test.ts`, `apps/web/lib/actions/*.test.ts` | Treat each finding's test list as part of its definition of done; add multi-line, multi-payment and non-active fixtures first | — | the five priority tests listed in `07-testing.md` |

---

## Part 4 — P2 (Medium)

| ID | Problema | Arquivos | Solução | Depende de |
|---|---|---|---|---|
| **A11Y-01** | Hero carousel auto-rotates every 6 s with no pause control, no hover/focus pause, and no `prefers-reduced-motion` — a WCAG 2.2.2 **Level A** failure on a project targeting AA. [d](02-frontend.md#a11y-01-the-hero-carousel-auto-rotates-with-no-pause-control-wcag-222) | `components/hero-carousel.tsx:11-22` | Pause button, pause on hover/focus, stop on interaction, respect reduced motion, `aria-live` on the slide | seed hero banners (TST-02) |
| **ARCH-02** | Two env-loading paths; `DATABASE_URL` bypasses the typed schema; `drizzle.config.ts` silently falls back to `localhost` so a forgotten env var migrates the wrong database. [d](01-architecture.md#arch-02-two-independent-environment-loading-paths-database_url-bypasses-the-typed-schema) | `lib/env.ts`, `packages/db/src/client.ts`, `lib/load-env.ts`, `drizzle.config.ts:9-12` | Remove the fallback (throw); make `load-env` a no-op when the var is already set; share one `databaseUrlSchema` | — |
| **ARCH-03** | Six documented capabilities don't exist: `/api/health`, axe-in-CI, component tests, canonical/OG metadata, the FeatureFlag UI, Zustand. [d](01-architecture.md#arch-03-six-documented-capabilities-do-not-exist-in-the-code) | `plan.md` §16/§19/§21/§24, `spec.md` §9/§10 | Build four (CFG-03, TST-01, TST-02, SEO-01); explicitly defer two, in the style of `tasks.md` 2.2 | the four sub-findings |
| **ARCH-05** | The order status machine is split across four functions in two files with three different guard styles, plus a fifth predicate in the action layer. Root cause of ECM-03/04/06. [d](01-architecture.md#arch-05-the-order-status-machine-is-split-across-three-files-with-no-single-owner) | `queries/orders.ts:311,374,416`, `queries/admin-orders.ts:77`, `lib/actions/orders.ts:35`, `schema/order.ts:18-24` | One `order-status.ts` with a transition table + `canTransition`/`assertTransition`; keep the `WHERE status = …` clauses as the concurrency guard | **land before ECM-03, ECM-04, ECM-06** |
| **BE-01** | `Number(searchParams.page)` → `NaN` → `offset(NaN)` → SQL error → **500** on every admin list page. The storefront has a correct parser that wasn't reused. [d](03-backend.md#be-01-numbersearchparamspage-produces-nan--sql-error--500-on-every-admin-list-page) | `admin/{products,orders,users,audit-log}/page.tsx`, `queries/admin-*.ts` | Extract `parsePage` into a shared helper; clamp `pageSize` in the query layer too (BE-11) | — |
| **BE-02** | Zod `.parse()` throws in every action, contradicting `plan.md` §20's typed-result contract. Any payload the client didn't pre-validate fails silently. [d](03-backend.md#be-02-zod-parse-throws-inside-server-actions-contradicting-the-documented-error-contract) | all `lib/actions/*.ts` | One `validate()` helper using `safeParse`; widen result unions with `ValidationFailure`; render field errors | pairs with FE-01, VAL-01 |
| **BE-03** | Duplicate SKU throws untyped; `VariantManager` reports *"check the SKU is unique"* for **any** error including Zod rejections. [d](03-backend.md#be-03-sku-uniqueness-violations-are-untyped-and-surface-as-a-misleading-error) | `queries/admin-variants.ts:16,40`, `lib/actions/admin-variants.ts`, `components/admin/variant-manager.tsx:76-92` | Mirror the products/categories `isUniqueViolation` pattern — **verify the real constraint name in `psql` first** | with BE-04, VAL-02 |
| **BE-04** | A product's **last** variant can be deleted, producing a page with no price, no stock and no Add-to-Cart — silently. [d](03-backend.md#be-04-a-products-last-variant-can-be-deleted-leaving-a-product-that-cannot-be-displayed-or-bought) | `queries/admin-variants.ts:69-89`, `components/product-variant-panel.tsx:32` | Count remaining variants in the transaction and return `last_variant`; disable the UI button; render an explicit unavailable state instead of `null` | with BE-03 |
| **BE-05** | `updateAddress` writes `isDefault` verbatim, so editing a sole address without ticking the box leaves the user with **zero** defaults. [d](03-backend.md#be-05-updateaddress-can-leave-a-user-with-zero-default-addresses) | `queries/addresses.ts:42-67` (esp. 55) | `isDefault = input.isDefault === true \|\| total === 1`; never clear the last default | pairs with DB-04 |
| **BE-09** | `proxy.ts` sets `redirectTo` and the sign-in form ignores it — users always land on `/account`. [d](02-frontend.md#be-09-redirectto-is-set-by-the-proxy-but-never-honoured) | `proxy.ts:19`, `sign-in/page.tsx`, `sign-in-form.tsx:53` | Read and honour it, validated with SEC-02's same-origin path validator | **after SEC-02** — otherwise this adds a second open redirect |
| **CFG-03** | `/api/health` is documented in `plan.md` §19 and doesn't exist; the compose `app` service has no healthcheck, so nothing waits for the app. [d](10-dependencies-and-config.md#cfg-03-the-documented-apihealth-route-does-not-exist-and-the-app-container-has-no-healthcheck) | `app/api/` (missing), `docker/docker-compose.prod.yml:9-41`, `Dockerfile` | A `select 1` route returning 200/503 with no detail; a `node -e fetch` compose healthcheck | — |
| **CFG-04** | The MinIO bucket is never created and never made public-read, so self-host image uploads fail — an undocumented manual step, against `spec.md` §8. [d](10-dependencies-and-config.md#cfg-04-the-minio-bucket-is-never-created-and-never-made-readable) | both compose files, `runbook.md` | A `minio/mc` init service running `mc mb` + `mc anonymous set download`; typed storage errors; document the requirement for real S3 | with CFG-02 |
| **CFG-05** | No Lighthouse and no a11y gate in CI, though both are `spec.md` §8/§9 success criteria — deferred three times for lack of a Chrome that CI already installs. [d](10-dependencies-and-config.md#cfg-05-ci-has-no-lighthouse-and-no-accessibility-gate-despite-both-being-success-criteria) | `.github/workflows/ci.yml` | Add `lighthouse-ci-action` against the running E2E server (warn first, then error); run the a11y spec on PRs; run E2E on PRs | TST-02; expect Performance to fail until ARCH-01 |
| **DB-02** | Every timestamp is `timestamp` (no time zone) receiving JS `Date`s, so meaning depends on the writing process's `TZ`. Banner scheduling and revenue bucketing silently shift on any TZ change. [d](05-database.md#db-02-every-timestamp-column-is-timestamp-no-time-zone-and-receives-js-date-values) | every `packages/db/src/schema/*.ts`, `queries/banners.ts`, `queries/admin-analytics.ts` | Convert to `timestamptz` in one migration; pin `TZ=UTC` in the image and compose; bucket analytics with an explicit `AT TIME ZONE 'UTC'`; simplify the banner form round-trip | do early, before more rows exist; FE-11 after |
| **DB-03** | `postgres()` uses library defaults — pool of 10, prepared statements on — against a documented Neon/pgBouncer target where prepared statements break under transaction pooling. Connection exhaustion already observed in dev. [d](05-database.md#db-03-the-postgres-client-uses-library-defaults-unsuited-to-the-documented-neonvercel-target) | `packages/db/src/client.ts:12` | `max`, `idle_timeout`, `connect_timeout`, `prepare: false`; `globalThis` guard for dev HMR; document `DATABASE_POOL_MAX` | verify pooler mode first |
| **DB-09** | `analytics_event` has no index, no retention, and its only writer is an unauthenticated, unrate-limited endpoint. [d](05-database.md#db-09-analytics_event-grows-without-bound-has-no-index-and-is-writable-by-anonymous-users) | `schema/ops.ts:47-55`, `api/analytics/track/route.ts` | Indexes (DB-01) + 90-day retention + rate limit (SEC-05) | fix all together (X-8) |
| **ECM-04** | The payment update has no status precondition while the order update does, so a late webhook marks the payment `succeeded` on a non-`pending` order, returns `"paid"` and sends a confirmation email. This divergence is what makes ECM-03 exploitable. [d](04-ecommerce.md#ecm-04-paymentstatus-is-set-to-succeeded-even-when-the-order-is-not-transitioned) | `queries/orders.ts:353-360` | Read the order status first, return `not_pending` without mutating; target the payment by id (DB-06); route through `assertTransition` | with DB-06, after ARCH-05 |
| **ECM-05** | Refunds neither restore stock nor write an inventory-log row; `inventoryChangeReasonEnum` has no `refund` value. Contradicts `spec.md` §5.13's "all changes recorded". [d](04-ecommerce.md#ecm-05-refunds-neither-restore-stock-nor-write-an-inventory-log-entry) | `queries/orders.ts:416-434`, `schema/ops.ts:6-10` | **Decide and document the policy first**; add the enum value via migration; restock + log in the same transaction; revalidate affected products | after ECM-01 (shares the helper) |
| **ECM-06** | `pending → cancelled` is never reachable; the enum value and its admin filter button are dead. Abandoned and expired orders accumulate forever with no cancel action, and a genuine card decline produces **no handled event at all**. [d](04-ecommerce.md#ecm-06-pending--cancelled-is-never-reachable-abandoned-and-expired-orders-accumulate-forever) | `schema/order.ts:18-24`, `queries/orders.ts:374`, `packages/payments/src/providers/stripe.ts:76-99`, `components/admin/order-actions.tsx:39` | `cancelOrder()`; distinguish `session.expired` (terminal) from a retryable decline; handle `payment_intent.payment_failed`; admin Cancel button; a documented expiry sweeper | **after ARCH-05**; FE-01 step 2 needs it |
| **ECM-07** | No checkout idempotency — double-click, two tabs or Back all create additional `pending` orders + payments from one cart, and two can both be paid (stock decremented twice, customer charged twice). `spec.md` §5.6 promises the opposite. [d](04-ecommerce.md#ecm-07-checkout-has-no-idempotency--one-cart-can-produce-many-orders-and-more-than-one-can-be-paid) | `lib/actions/checkout.ts:33-78`, `queries/orders.ts:51-144` | Reuse an existing open order for the cart (+ a partial unique index), or an idempotency key; cancel superseded orders | ECM-06, DB-01, FE-01 |
| **ECM-08** | `createOrder` validates outside the transaction that writes, with no lock — a price change in the window is written at the stale snapshot and never re-checked. [d](04-ecommerce.md#ecm-08-createorder-validates-and-writes-in-two-separate-transactions) | `queries/orders.ts:57-141` | Move the validation `SELECT` inside the transaction with `FOR SHARE`/`FOR UPDATE` | do inside ECM-01's restructure |
| **ECM-09** | The guest→user cart merge runs ~`2+3N` statements with **no transaction**, and silently drops items whose stock hit zero. A mid-merge failure leaves a half-merged cart. [d](04-ecommerce.md#ecm-09-guestuser-cart-merge-is-not-transactional-and-silently-discards-items) | `queries/cart.ts:223-278`, `lib/actions/cart.ts:74-82` | Wrap in one transaction; return a summary of clamped/dropped items and surface it as a toast; document the price-snapshot rule for duplicates | — |
| **ECM-10** | The confirmation page buckets `refunded` as paid ("Thank you for your order!"), renders **nothing** for `cancelled`, tells oversold customers they weren't charged, and leaves the poller stuck after 20 s. [d](04-ecommerce.md#ecm-10-the-confirmation-page-shows-thank-you-for-your-order-for-refunded-orders-and-nothing-for-cancelled-ones) | `order/confirmation/[id]/page.tsx:21-23`, `components/order-status-poller.tsx` | Exhaustive `switch` over `OrderStatus` (TS then enforces coverage); gate the analytics beacon on `paid`/`fulfilled`; add a terminal poller state | ECM-01, ECM-06 define the new states |
| **EDGE-03** | `UpstashRateLimiter.limit` doesn't catch — an Upstash outage throws inside `checkoutAction`, which (per FE-01) shows the user nothing. A rate-limiter outage becomes a **checkout outage**. [d](09-edge-cases.md#edge-03-a-rate-limiter-outage-takes-checkout-down-entirely) | `packages/ratelimit/src/providers/upstash.ts:17-20`, `lib/actions/checkout.ts:37`, `api/webhooks/stripe/route.ts:20` | Fail **open** inside the provider with a `degraded` flag; log at `warn`; add a timeout | — |
| **FE-02** | Cart quantity stepper sends an absolute value computed from a stale prop → lost updates on fast clicks; no optimistic UI, and every click triggers a whole-layout revalidation. [d](02-frontend.md#fe-02-cart-quantity-stepper-loses-updates-on-rapid-clicks-and-has-no-optimistic-ui) | `components/cart-line-item.tsx:21-32, 67-89` | Switch to a server-computed delta; add `useOptimistic`; catch remove failures | **after PERF-01** |
| **FE-03** | The search bar `router.push`es on every 400 ms debounce, so Back walks through the user's keystrokes. [d](02-frontend.md#fe-03-the-search-bar-pushes-a-history-entry-per-debounce-breaking-the-back-button) | `components/search-bar.tsx:23-33` | `router.replace` for debounced navigation, `push` only on explicit submit; fix FE-05 in the same edit | — |
| **FE-13** | Session expiry mid-checkout returns `guest_email_required` while the email field is **not rendered** — an error the user cannot act on. `spec.md` §7's documented redirect doesn't exist. [d](02-frontend.md#fe-13-session-expiry-mid-checkout-produces-an-unactionable-error) | `components/checkout-form.tsx:19,66-83`, `lib/actions/checkout.ts:40-43` | Redirect to `/sign-in?redirectTo=/checkout`, or always render the email field (read-only when signed in) | BE-09 (so `redirectTo` works) |
| **PERF-02** | `word_similarity(a,b) > 0.2` cannot use `gin_trgm_ops` — only the `<%` operator can. Every search seq-scans and computes trigrams per row, **twice** (rows + count). The migration-0003 index is unused. [d](08-performance.md#perf-02-the-trigram-index-cannot-be-used-by-the-search-query-it-was-created-for) | `queries/products.ts:55-67,173-200`, `migrations/0003` | Use `<%` with an explicit threshold; run the fallback **only when FTS returns nothing** (as `plan.md` §11 specifies); merge the count with `count(*) OVER ()` | verify with `EXPLAIN` first |
| **PERF-04** | The header issues 4 queries on every request including static pages, and fetches **full cart contents** to render a badge. Also the cause of ARCH-01. [d](08-performance.md#perf-04-the-site-header-issues-four-queries-on-every-request-including-on-static-content-pages) | `components/site-header.tsx:14-19`, `app/layout.tsx:58` | `getCartItemCount` for the badge; load drawer contents on open; `cache()` the duplicated `listCategoryTree` | with ARCH-01 |
| **SEC-05** | `/api/analytics/track` is unauthenticated and unrate-limited, accepts any funnel event including `checkout_completed`, and writes to an unindexed unbounded table — so the conversion dashboard is both forgeable and progressively slower. [d](06-security.md#sec-05-apianalyticstrack-is-unauthenticated-unrate-limited-and-writes-to-an-unindexed-table) | `api/analytics/track/route.ts:22-40`, `lib/analytics-session.ts` | Rate-limit by session cookie; move `checkout_completed` server-side (verify the order is `paid`) and narrow the accepted enum; retention + indexes | with DB-01, DB-09 (X-8) |
| **SEC-06** | Better Auth's 5-minute `cookieCache` includes `user.role`, so a demoted admin keeps admin access — and a revoked session keeps validating — for up to 5 minutes. `requireAdmin` "re-checks" a cache, not the database. [d](06-security.md#sec-06-better-auths-cookie-cache-delays-role-revocation-and-session-invalidation-by-up-to-5-minutes) | `lib/auth.ts:47-52`, `lib/auth-guards.ts:7` | `disableCookieCache` for `requireAdmin` only; delete the target's sessions on a role change; document the remaining `requireUser` window | verify the cache contains `role` first |
| **SEC-12** | The webhook receives `amountCents` and discards it — the paid amount is never compared to the order total, and `payment.amount_cents` is never reconciled. [d](06-security.md#remaining-security-findings-p3) | `api/webhooks/stripe/route.ts:40-49`, `packages/payments/src/providers/stripe.ts:87` | Pass amount + currency into `fulfillPaidOrder`; on mismatch do **not** mark paid — `amount_mismatch` outcome, `error` log, manual review | after ECM-01 restructures the function |
| **SEO-01** | The sitemap silently truncates at 100 products; there is no `metadataBase`, canonical, Open Graph or Twitter metadata anywhere; `robots.ts` doesn't disallow `/order/confirmation` (which renders a customer's address with no auth). [d](02-frontend.md#seo-01-sitemap-silently-truncates-at-100-products-no-canonical-open-graph-or-twitter-metadata) | `app/sitemap.ts:16`, `app/robots.ts:10`, every `generateMetadata`, `catalog/[category]/page.tsx:11` | Paginate the sitemap (or `listAllProductSlugs`) with `lastModified`; add `metadataBase` + canonical + OG/Twitter; `noindex` filtered catalog URLs; extend the robots disallow list; use the category **name** not the slug | OG images need IMG-01's validator |
| **TST-04** | The `unique()` test-id helper is `Date.now()`-based with a module-scoped counter, so parallel test **files** collide on unique constraints — a known, documented flake that was never fixed. [d](07-testing.md#tst-04-the-unique-test-id-helper-is-datenow-based-and-is-a-known-flake-source) | six duplicated copies, e.g. `queries/orders.test.ts:29-33` | One `randomUUID()`-based helper exported from `@medivi/db/test`; prefer `withTestTransaction`; make real-pool cleanup `try/finally`-safe | — |
| **TST-05** | E2E gaps: no wishlist (explicitly in scope), no decline path, no out-of-stock/price-changed at checkout, no guest lookup, no address book, no password reset, **no mobile viewport**, and E2E only runs on `master`. [d](07-testing.md#tst-05-e2e-coverage-gaps) | `apps/web/e2e/`, `playwright.config.ts:25`, `.github/workflows/ci.yml:84` | Add the wishlist + failure-path specs; add a mobile project; run the purchase journey and a11y spec on PRs; export seed slugs as constants | with CFG-05 |
| **VAL-01** | No Zod string has a `.max()` and no number has an upper bound. An anonymous guest can persist ~1 MB per address field (rendered in admin, sent by email); out-of-range integers raise an uncaught `22003` → 500. [d](03-backend.md#val-01-no-zod-string-has-a-maximum-length-no-number-has-an-upper-bound) | all `apps/web/lib/schemas/*.ts` | Explicit `.max()` per field (table in `03-backend.md`); numeric bounds; mirror the email-reaching fields as DB `CHECK`s; add `isNumericOutOfRange` to `pg-errors.ts` | do early — cheap, reduces several blast radii |
| **VAL-02** | `z.coerce.number()` turns `""` into `0`, so the `.or(z.literal(""))` branch is dead and a cleared price override becomes **0** — and `?? ` then can't fall back, making the product free. Latent today (the form pre-empts it); live the moment an edit UI exists. [d](03-backend.md#val-02-variantschemapriceoverridecents-coerces-an-empty-string-to-0) | `lib/schemas/variant.ts:6`, `queries/products.ts:300`, `queries/cart.ts:161` | Union with an explicit empty/null branch **first**, `.min(1)`; replace the `??` reads with explicit null checks | with BE-06 |

---

## Part 5 — P3 (Low)

Grouped by area. Each entry: problem → files → recommendation. Full detail in
the linked area document.

### Architecture & config
| ID | Problema → Solução |
|---|---|
| **ARCH-04** | `(account)` mixes public auth pages with protected ones → split into `(auth)` and `(account)`; a future layout-level guard would lock users out of `/sign-in`. `app/(account)/**`, `proxy.ts:27` |
| **CFG-06** | No formatter configured despite `plan.md` listing one → add Prettier + `prettier-plugin-tailwindcss` + a `format:check` CI step; commit the initial reformat separately |
| **CFG-07** | No type-aware lint rules → enable `recommendedTypeChecked` + `switch-exhaustiveness-check`; `no-floating-promises` alone would have caught FE-01 and `user-menu.tsx:63` |
| **CFG-08** | `axe-core` unused; `drizzle-orm`/`stripe` are devDeps of `apps/web` but runtime deps transitively; `packages/ui` declares `react` as a `dependency` not a peer; `packages/storage` has no `test` script |
| **CFG-09** | `pnpm audit \|\| true` with 11 accepted high advisories and no tracking → add an allowlist file and fail on anything not in it; consider replacing `image-size` with `sharp` |
| **CFG-10** | `runbook.md:157` points at `packages/db/drizzle/`; the real path is `packages/db/migrations/` — and it's in the **rollback** section |
| **CFG-11** | CI: unquoted heredoc for `.env`; `cancel-in-progress` on `master`; no `STORAGE_PROVIDER` set (so the upload path has zero CI coverage); E2E master-only |
| **CFG-12** | Docker: no `HEALTHCHECK` (CFG-03), no `TZ=UTC` (DB-02), no image scanning |

### Database
| ID | Problema → Solução |
|---|---|
| **DB-04** | No partial unique index for "one default address per user" → `CREATE UNIQUE INDEX … ON address (user_id) WHERE is_default` (pairs with BE-05) |
| **DB-05** | "Every product has ≥1 variant" is a comment, not a constraint → enforce in `deleteVariantAdmin` (BE-04) + a data-integrity assertion in the test suite |
| **DB-07** | The seed isn't idempotent and isn't transactional; the seeded admin has no credential and the runbook never says how to become admin → wrap in a transaction, add `onConflictDoNothing` or a `--reset` flag reusing the E2E TRUNCATE list, document the admin promotion SQL |
| **DB-08** | `processed_webhook_event` grows forever → 30-day retention + an index on `processed_at`; document the reasoning in `architecture.md` §3 |
| **DB-10** | `feature_flag` is a dead table with no query, UI or test → build the small admin toggle or drop it; an empty table implies a feature that doesn't exist |

### E-commerce
| ID | Problema → Solução |
|---|---|
| **ECM-11** | The cart merge deletes the guest cart, nulling `order.cart_id` on any open pending order → the purchased items are never cleared from the merged cart. Re-point open orders at the surviving cart inside ECM-09's transaction |
| **ECM-12** | Currency is modelled on four tables and hardcoded `"USD"` in `createOrder` → read it from the product/cart and add a same-currency check per order |
| **ECM-13** | `tax_cents` is always 0 with no tax concept → out of scope per `spec.md` §2, but add a comment at the call site and a line in `spec.md` §6 Non-Goals |
| **ECM-14** | No order-value or per-line caps beyond `.max(99)`, no fraud/velocity signal → **Recommendation**: a documented cap plus a note on where fraud checks would hook in |
| **ECM-15** | "Move wishlist item to cart" (`spec.md` §3.2) isn't built → build it (linking to the product page for variant choice) or strike the sentence |
| **EDGE-01** | Two admins can demote each other to **zero** admins; only self-demotion is blocked → count remaining admins in the transaction and reject a demotion that would reach zero |
| **EDGE-02** | The welcome/verification/reset email hooks have no `try/catch`, unlike the order-confirmation path — a Resend failure may fail signup after the user row is committed → wrap all three, log, and keep the resend affordance |

### Frontend
| ID | Problema → Solução |
|---|---|
| **FE-04** | `AnalyticsBeacon` has no Strict-Mode ref guard (unlike `CheckoutCompletedBeacon`) → double-counts page views in dev/E2E; add the same pattern |
| **FE-05** | The header `SearchBar` doesn't reflect the active query on `/search` → pass `initialQuery` (bundle with FE-03) |
| **FE-06** | Out-of-range `page` renders "No products found" while `total > 0`; `minPrice > maxPrice` yields silent zero results → clamp the page and add a distinct "no results for these filters" state that keeps the filters visible |
| **FE-07** | Delete category / variant / product image / address are all one-click with no confirmation; the image delete is irreversible and also removes the storage object → add a `Dialog` confirm (the primitive exists) |
| **FE-08** | `updateCartItemAction`/`removeCartItemAction` report success for no-ops → return `not_found` so a stale drawer self-corrects |
| **FE-09** | The gallery uses `tablist`/`tab` with no tabpanel or `aria-controls`; the zoom overlay is `role="dialog" aria-modal` with no focus trap or restore → use plain buttons with `aria-current`, and the existing `Dialog` primitive for the overlay |
| **FE-10** | The newsletter form fakes a subscription → **Question**: persist it, or change the copy to be honest about the demo (the stronger portfolio signal) |
| **FE-11** | `toLocaleString()` in Server Components renders dates in the **server's** locale/TZ → emit `<time dateTime>` and format client-side (after DB-02) |
| **FE-12** | `sortVariantsForDisplay`'s comparator returns 0 when either operand is unranked — non-transitive, so mixed sized/unsized variants order unpredictably → map to a total-order sort key |
| **FE-14** | On `/wishlist`, removing an item only flips the heart — `WishlistButton` never triggers a router refresh, so the card stays on screen until a manual reload, on the one page where it should disappear → add `router.refresh()` after a successful toggle, or an `onRemoved` callback. Bundle with FE-08 |

### Backend
| ID | Problema → Solução |
|---|---|
| **BE-06** | `updateVariantAction`/`updateVariantAdmin` are fully implemented and called by nothing — an admin cannot fix a typo'd variant name or SKU → build the inline edit row (recommended) or delete both |
| **BE-07** | `getShippingMethod` throws on an unknown id inside `checkoutAction` → return `undefined` and produce a typed `invalid_shipping_method` result |
| **BE-08** | The analytics route returns 200 even when the insert threw, with no metric → keep the 200 (correct for a beacon) but add a counter and richer log context |
| **BE-10** | Currency and locale hardcoded despite being modelled → see ECM-12 |
| **BE-11** | Admin list queries accept an unclamped `pageSize`, unlike the storefront's 100 cap → clamp in BE-01's shared helper |

### Security
| ID | Problema → Solução |
|---|---|
| **SEC-08** | `/order/confirmation/<uuid>` renders a full shipping address with no auth and isn't `noindex`ed or robots-disallowed — and (until SEC-01) the same URL is a payment capability → add the disallow + a page-level `noindex`; `Referrer-Policy` (SEC-03) reduces leakage |
| **SEC-09** | `bannerSchema.ctaHref` has **no** URL validation and is rendered as an `href` — an admin can store a `javascript:` URL that runs for every visitor → allow only a relative path or an `https:` URL; CSP (SEC-03) neutralises it |
| **SEC-10** | The `material` filter reaches `ilike` with `%`/`_` unescaped — not injection (parameterised) but wildcards are honoured → escape them, or use `eq()` since the UI only sends exact values |
| **SEC-11** | `docker-compose.prod.yml` hardcodes `POSTGRES_PASSWORD`/`MINIO_ROOT_PASSWORD`; the dev compose binds all three services to `0.0.0.0` → require the vars (`${X:?required}`) and bind dev ports to `127.0.0.1` |
| **SEC-13** | Better Auth's `rateLimit` auto-enables **in production only**, so no test can exercise sign-in throttling → set `enabled: true` explicitly with a permissive non-prod limit and add one test |
| **SEC-14** | `signIn.email`'s library error message is rendered verbatim → map known `error.code`s (the file already does this for `EMAIL_NOT_VERIFIED`) and use a generic fallback |
| **SEC-15** | Uploads are stored with the browser-supplied `ContentType` → derive it from `imageSize()`'s detected type and serve with `nosniff` |

### Testing & performance
| ID | Problema → Solução |
|---|---|
| **TST-06** | `packages/storage` has no tests and no `test` script — and CFG-02 would have been caught by one → add `s3.test.ts` covering `sanitizeFilename`, the returned URL shape, and `delete`'s key extraction (incl. rejecting foreign URLs) |
| **TST-07** | Environment gaps hide real code paths: `headers()` is stubbed to `null` (so SEC-04's parser is unexecuted), Better Auth rate limiting is prod-only, CI sets no `STORAGE_PROVIDER`, Playwright runs chromium only → set the missing CI vars, add a Firefox project, unit-test the identifier parser |
| **PERF-05** | `getOrderById` runs 3–4 sequential round trips that are mutually independent → `Promise.all` after the first; also add a cheap ownership pre-check in `getOrderForUser` |
| **PERF-06** | OFFSET pagination plus a separate `count(*)` on unindexed tables → DB-01's indexes fix most of it; merge the count with `count(*) OVER ()`; **do not** switch to keyset pagination now |
| **PERF-07** | `Geist_Mono` is loaded on every page for one admin table; verify `radix-ui` meta-package tree-shaking with the bundle analyzer; seed images depend on `picsum.photos`, so the "offline demo" isn't offline |

---

## Part 6 — Explicit non-findings

Recorded so the implementing agent does not "fix" correct code:

- **No internal API layer.** Deliberate and correct for a single deployable.
- **`getOrderById` has no ownership check.** Documented, intentional, and the
  authenticated path (`getOrderForUser`) is separate and tested.
- **Mock approve calls `fulfillPaidOrder` directly** rather than posting a fake
  webhook — this is what keeps the fulfilment path identical across providers.
- **`listProducts`' correlated subqueries** are one query, not N+1, and there
  is a real query-count test proving it.
- **`getWishlistedProductIds` returning a `Set`** — evaluated server-side, never
  serialised. Correct.
- **`packages/*` not importing each other** — stricter than the documented
  rule; keep it.
- **Sentry's dynamic import** — a deliberate fix for a real 400 KB regression.
  Do not convert to a static import.
- **Soft-delete via `product.status`** — a hard delete is impossible while
  `order_item` holds a restrict FK. Correct.
- **`sign-in` `refresh()`-before-`push()` and `sign-out` `push()`-before-`refresh()`**
  — opposite orderings, both deliberate, both fixing real production-only
  navigation races documented in `tasks.md` 11.3. Do not "normalise" them.
- **Zero `any` in the codebase.** Preserve this.
