# Medivi Shop — Audit and Fix Plan

Status: Active backlog  
Last updated: 2026-08-14

This document records the first project-wide audit after implementation of
Phases 0–10. It is deliberately a planning document: Medivi Shop is a
portfolio blueprint, so not every missing production concern is a defect in
the current demo. Each item below is classified so future projects can keep
the useful architecture without accidentally inheriting an unsafe behavior.

Companion documents: [spec.md](spec.md), [architecture.md](architecture.md),
[plan.md](plan.md), and [tasks.md](tasks.md).

## Audit Scope and Verification

Reviewed areas:

- Monorepo configuration, environment setup, Docker, CI, and deployment
  readiness.
- Storefront catalog, cart, checkout, order, payment, account, admin,
  analytics, SEO, email, storage, and accessibility-adjacent components.
- Schema/query logic and the existing Vitest coverage.

Checks run on 2026-08-14:

| Check | Result | Notes |
| --- | --- | --- |
| `pnpm --filter './packages/*' lint` | Pass | All package lint checks passed. |
| `pnpm --filter './packages/*' typecheck` | Pass | All package type checks passed. |
| `pnpm --filter @medivi/web typecheck` | Pass | Web type check passed. |
| `pnpm --filter @medivi/web lint` | Pass with warning | React Compiler skips optimization around React Hook Form's `watch()` in `components/checkout-form.tsx`. |
| `pnpm --filter @medivi/web build` | Fail | Compilation and type check pass; sitemap prerender fails because PostgreSQL is unavailable. |
| `pnpm test` | Not runnable in this environment | The local PostgreSQL/Docker service is down, so DB-backed web tests fail with `ECONNREFUSED`. A cached Turbo result should not be treated as a fresh integration-test pass. |

The current shell uses Node 22.22.2 while the repository declares Node 24+.
Use Node 24+ for subsequent verification.

## Classification

### Intentional blueprint limitations

These are explicitly suitable for a portfolio/demo build, but must be
completed or replaced before a real launch:

- Mock payments are available for offline demos and tests.
- No rate limiter, Sentry, structured logging, formal accessibility scan,
  Lighthouse pass, Playwright suite, deployment runbook, or production Docker
  image has been completed. These are already tracked in Phase 10.2–10.6 and
  Phase 11 of `docs/tasks.md`.
- Newsletter submission is UI-only and intentionally not persisted.
- Legal pages are placeholders.

### Defects or unsafe carry-over behaviors

The entries below should be fixed before treating this blueprint as a base
for a real commerce project. Priorities: **P0** blocks any real payment use;
**P1** blocks a dependable deployment or normal commerce behavior; **P2** is
important hardening, correctness, or usability work.

## P0 — Real-Payment Safety

### A1. Mock approval can fulfill a real-provider order

**Status:** Implemented and verified  
**Location:** `apps/web/lib/actions/mock-checkout.ts`,
`apps/web/app/(storefront)/checkout/mock/[token]/page.tsx`

`approveMockPayment()` accepts an arbitrary pending order UUID and calls
`fulfillPaidOrder()` with `provider: "mock"`. It does not verify that the
configured provider is mock, nor that the order has a matching pending mock
payment. The mock checkout page is similarly reachable regardless of the
configured provider.

In a Stripe deployment, this would leave a callable path that can mark an
order paid without a confirmed Stripe charge.

**Fix plan:**

1. Make the mock checkout page return `notFound()` unless
   `env.PAYMENT_PROVIDER === "mock"`.
2. Make both mock actions reject unless the active provider is mock.
3. In the fulfillment transaction, require one matching payment row with
   provider `mock`, status `requires_payment`, and the expected provider
   reference before changing inventory or order state.
4. Do not accept caller-controlled redirect origins; derive success/cancel
   destinations from the order/app origin, or restrict them to same-origin
   relative paths.

**Acceptance checks:**

- With `PAYMENT_PROVIDER=stripe`, `/checkout/mock/<id>` is a 404 and direct
  calls to either mock server action cannot change payment, order, cart, or
  stock data.
- With `PAYMENT_PROVIDER=mock`, the normal demo approve/decline flow still
  works.
- Add tests covering provider mode, payment-row mismatch, and an external
  redirect attempt.

### A2. Partial oversell commits inventory changes

**Status:** Implemented and verified  
**Location:** `packages/db/src/queries/orders.ts` (`fulfillPaidOrder`)

The fulfillment loop decrements variants one at a time. If an earlier item
has stock and a later one does not, the function returns `oversold` from the
transaction callback. Returning commits the transaction, so the earlier
stock decrement and inventory log persist even though the payment/order is
recorded as failed.

**Fix plan:**

1. Reserve/decrement all required variants atomically. Lock the relevant
   variant rows in a stable order, validate all quantities, then apply all
   decrements only when every line can be fulfilled.
2. If validation fails, roll back the reservation transaction and record the
   failed payment in a separate, deliberate transaction.
3. Keep webhook idempotency, but only record a successful fulfillment event
   after the order/payment transition is valid.

**Acceptance checks:**

- A two-line order with one unavailable line leaves *both* variant stocks and
  inventory logs unchanged and marks the payment failed.
- Existing concurrent last-unit test still permits exactly one paid order.
- Add a regression test for the multi-item partial-oversell case.

## P1 — Commerce Correctness and Delivery

### B1. CI and a clean production build lack database provisioning

**Status:** Open  
**Location:** `apps/web/app/sitemap.ts`, `.github/workflows/ci.yml`

`sitemap()` queries categories and products at build time. The current CI job
sets no app environment, starts no PostgreSQL service, runs no migration, and
does not run tests. A local web build compiled and type-checked successfully,
then failed while prerendering `/sitemap.xml` because PostgreSQL was not
available.

**Fix plan:**

1. Choose the sitemap strategy: use runtime revalidation/dynamic rendering,
   or make build infrastructure reliably provide a read-only database.
2. Add an ephemeral Postgres service to CI, provide safe test environment
   values, apply migrations, and seed only if a check needs seed data.
3. Run `pnpm test` in CI; add Playwright once Phase 11 begins.
4. Document the required build/deploy environment in `docs/runbook.md`.

**Acceptance checks:**

- A fresh clone passes lint, typecheck, test, and build in CI without
  developer-local files.
- `/sitemap.xml` works in production and does not make deployment dependent
  on an undocumented local database.

### B2. Draft or archived products can remain purchasable

**Status:** Open  
**Location:** `packages/db/src/queries/cart.ts`,
`packages/db/src/queries/orders.ts`

Cart addition and checkout validate a variant, price, and stock, but do not
require the parent product status to be `active`. An existing cart can be
checked out after an admin archives a product; a caller that knows a variant
UUID can also add a non-active product directly.

**Fix plan:**

1. Require `product.status = 'active'` in add-to-cart and checkout
   validation queries.
2. Return a specific `unavailable` result so the cart UI can explain and
   remove/disable the affected item.
3. Decide whether a product becoming inactive should immediately remove cart
   lines or merely block checkout; document the chosen policy.

**Acceptance checks:**

- Draft and archived products cannot be added through an action call.
- A cart containing a newly archived product cannot create an order and has a
  clear recovery path in the UI.

### B3. Price-change handling traps the customer on a stale cart

**Status:** Open  
**Location:** `packages/db/src/queries/orders.ts`,
`apps/web/components/checkout-form.tsx`

Checkout correctly rejects a price snapshot that no longer matches the live
price. However, it leaves the stale snapshot in place and provides no
"accept updated price" or refresh mechanism. Adding the same item increments
the existing cart line without refreshing its price, so the customer must
discover that they need to remove and re-add it.

**Fix plan:**

1. Return structured line-level price changes from checkout.
2. Add an explicit cart action/UI to accept the current price or remove the
   unavailable line.
3. Refresh line totals and show the changed price before a second payment
   attempt.

**Acceptance checks:**

- After a price change, a customer can resolve the cart in one obvious UI
  step and then check out successfully.
- The customer never silently pays a price they did not see/accept.

### B4. Payment/order lifecycle permits duplicate pending checkouts

**Status:** Open  
**Location:** `apps/web/lib/actions/checkout.ts`,
`packages/db/src/queries/orders.ts`

The cart is intentionally preserved until a payment succeeds, but repeated
checkout submissions can create multiple pending orders and payment sessions
for the same cart. There is no idempotency key or pending-order reuse. This
can produce duplicate payment links and, if more than one session completes,
multiple paid orders for the same cart contents.

**Fix plan:**

1. Define a checkout idempotency boundary (cart version/idempotency key or a
   single active pending payment per cart).
2. Reuse a valid pending payment session when practical, or explicitly expire
   and replace it before creating another.
3. In fulfillment, require a pending order and matching pending payment;
   return a non-paid outcome if either is already settled.

**Acceptance checks:**

- Double-clicking Pay creates at most one chargeable payment session.
- A second distinct provider event cannot decrement inventory or mark a
  settled order paid again.

## P2 — Hardening, Indexing, and UX

### C1. Sitemap omits products after the first 100

**Status:** Open  
**Location:** `apps/web/app/sitemap.ts`

The sitemap calls `listProducts({ pageSize: 100 })`, which caps the output at
100 active products. The catalog itself supports more, so later products will
not be discoverable through the sitemap.

**Fix plan:** paginate all active products or use Next's multiple-sitemap
support. Add a test with more than 100 products.

### C2. Catalog prices and price filters ignore variant overrides

**Status:** Open — confirm intended merchandising rule  
**Location:** `packages/db/src/queries/products.ts`,
`apps/web/components/product-card.tsx`

Product detail uses a selected variant's overridden price, while cards,
sorting, and price filters use `product.basePriceCents`. For products with
variant price overrides, catalog pricing can be misleading and a price-range
filter can exclude a purchasable variant.

**Fix plan:** choose and document the storefront pricing rule. The usual rule
is to display and filter by the lowest active variant price ("From $X") and
sort by that same value. Add query tests for overridden prices.

### C3. Order confirmation is an unexpired bearer URL containing PII

**Status:** Open — security policy decision  
**Location:** `apps/web/app/(storefront)/order/confirmation/[id]/page.tsx`,
`packages/db/src/queries/orders.ts`

Anyone with an order UUID can view its line items and shipping address. UUIDs
are difficult to guess, but this is a durable bearer credential that can leak
through a copied link, browser history, or referral context.

**Fix plan:** keep immediate redirect convenience but protect durable access
with an authenticated owner check, a short-lived signed receipt token, or the
existing guest email + order-number verification flow. Ensure sensitive URLs
send an appropriate `Referrer-Policy`.

### C4. Analytics endpoint is writable without throttling or event integrity

**Status:** Open — expected Phase 10.5 work  
**Location:** `apps/web/app/api/analytics/track/route.ts`

Any client can create unlimited analytics rows and can submit
`checkout_completed` events. This can inflate metrics and create avoidable DB
load.

**Fix plan:** add rate limiting, cap events per anonymous session, and derive
purchase completion from trusted order state or validate it against the
session/order relationship.

### C5. Image zoom dialog is not keyboard-modal

**Status:** Open — expected Phase 10.2 work  
**Location:** `apps/web/components/product-gallery.tsx`

The zoom overlay has `role="dialog"` but does not move focus into the dialog,
trap focus, restore focus on close, or include a visible close button.

**Fix plan:** replace the hand-rolled overlay with the shared dialog primitive
or implement the full modal interaction contract. Verify it with keyboard and
axe tests.

### C6. React Compiler warning in checkout form

**Status:** Open — low risk  
**Location:** `apps/web/components/checkout-form.tsx`

React Hook Form's `watch()` prevents React Compiler memoization for this
component. It is not a functional error, but it keeps lint from being clean.

**Fix plan:** evaluate `useWatch` or isolate the shipping-total display in a
small non-memoized component; retain current behavior with a component test.

## Recommended Execution Order

1. **A1 and A2:** make the payment boundary and inventory transaction safe.
2. **B4:** add checkout/session idempotency and enforce payment state in
   fulfillment.
3. **B1:** make build, tests, migrations, and CI reproducible from a clean
   checkout.
4. **B2 and B3:** finish normal catalog/cart recovery behavior.
5. **C1–C6:** address indexing, accessibility, analytics, privacy policy,
   and lint polish alongside Phase 10/11 work.

## Implementation Record

### Phase A — Payment and inventory safety (2026-08-14)

- Implemented A1: mock checkout now requires mock-provider mode, verifies a
  matching mock payment before rendering, and passes same-origin relative
  return paths only.
- Implemented A2: fulfillment locks all ordered variants before validation,
  checks the matching pending payment, and changes no inventory when any line
  is unavailable.
- Added regression coverage for disabled mock mode, external redirect input,
  provider/payment mismatch, and multi-item partial oversell.
- Package lint passes (with one pre-existing React Hook Form compiler warning).
  Focused database-backed tests pass: 23 database-query tests and 5 mock-action
  tests.

### Phase B — Catalog usability (2026-08-14)

- Stabilized the catalog shell with a full-width container, so the category
  sidebar no longer shifts based on the product-grid width.
- Styled the native material and sort selects with explicit foreground,
  background, and native `color-scheme` values, keeping their option lists
  readable in dark mode without giving up the no-JavaScript GET form flow.
- Verified the Armor menu and theme toggle work when the app is served through
  `localhost`; the reported failures at `127.0.0.1:3000` were caused by a
  Next.js development-server cross-origin HMR restriction, not those controls.

## Test Backlog Added by This Audit

- Mock action is inaccessible and non-mutating in Stripe mode.
- Fulfillment rejects payment-provider/reference/state mismatches.
- Multi-line partial oversell leaves no stock or inventory-log side effects.
- Repeated checkout attempts are idempotent.
- Archived/draft product cart and checkout behavior is enforced.
- Price-refresh/acceptance flow updates totals before payment.
- Sitemap contains more than 100 active products.
- Confirmation access requires the chosen owner/token policy.
- Keyboard/axe coverage for image zoom and checkout.

## Out of Scope for This Audit

No secrets were inspected or recorded, and no live payment, email, storage,
or deployment account was accessed. The documented Phase A and Phase B fixes
were implemented locally and verified with focused automated/browser checks.
