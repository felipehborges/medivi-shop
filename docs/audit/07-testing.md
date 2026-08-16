# 07 — Testing

Findings: `TST-01` … `TST-07`.

**This document does not contain test code.** It specifies which tests should
exist and exactly what each must assert.

---

## 1. What exists today

`pnpm test` runs Vitest across four workspaces. `tasks.md` Phase 11 reports
200 passing tests; I counted **207 `it(...)` calls across 38 files**.

| Workspace | Files | Tests | Runs against |
|---|---|---|---|
| `packages/db` | 19 | 116 | **a real Postgres**, per-test transaction rollback |
| `apps/web` | 15 | 68 | a real Postgres + mocked `next/*` modules |
| `packages/payments` | 2 | 9 | pure unit (real Stripe signature crypto) |
| `packages/email` | 1 | 4 | pure unit (real React Email render) |
| `packages/ratelimit` | 1 | 3 | pure unit |

E2E: 4 Playwright specs (`purchase-journey`, `auth-journey`,
`admin-journey` ×2 tests), chromium only, `workers: 1`, run against a
**production build** (`next build && next start`) with `PAYMENT_PROVIDER=mock`.

### What is genuinely strong

This is well above the norm for a project of this size, and the implementing
agent should not weaken it:

- **Integration tests hit a real database.** `withTestTransaction`
  (`packages/db/src/test/index.ts`) opens a dedicated single connection,
  runs the test inside a transaction, and always rolls back via a sentinel
  symbol. No mocked ORM, no in-memory fake — the constraints, the generated
  `tsvector`, the CHECKs and the FK behaviour are all genuinely exercised.
- **A real concurrency test.** `orders-concurrency.test.ts` deliberately
  *avoids* the single-connection helper and fires two `fulfillPaidOrder` calls
  on separate pooled connections at a stock-1 variant, asserting exactly one
  `paid`, one `oversold`, and stock never negative. This is the hard test most
  projects skip.
- **A real N+1 assertion.** `products.test.ts` uses `withTestTransaction`'s
  `onQuery` hook (postgres.js `debug`) to assert the query count does not grow
  between 5 and 20 result rows — an actual invariant, not a pinned number.
- **Constraint tests.** `schema/constraints.test.ts` proves the cart owner XOR
  and the non-negative stock CHECK reject bad data at the database level.
- **Authorization tests per module.** Each `admin-*.test.ts` in `apps/web`
  mocks `requireAdmin` to assert every new Server Action rejects a non-admin
  caller — the check most often skipped.
- **Audit-log assertions per mutation.** Every admin query test asserts the
  audit row was written in the same transaction.
- **Webhook route tested as a route.** `api/webhooks/stripe/route.test.ts`
  calls `POST` with a real `Request` and a real Stripe-signed body, including
  tampered and missing signatures.
- **Email tests assert content, not snapshots.** `render.test.ts` checks for
  the order number, totals and links rather than opaque HTML — the right call,
  explained in `tasks.md` 8.5.
- **Auth tests are real.** `auth.test.ts` performs actual sign-up/sign-in
  against the live DB, including the `EMAIL_NOT_VERIFIED` path and the
  no-hard-conflict-on-duplicate-signup behaviour (asserted on DB state, not on
  an exception — correct).

---

## 2. Coverage map

Green = tested. Amber = partially tested. Red = untested.

| Area | Status | Notes |
|---|---|---|
| Catalog filters / sort / pagination / search | 🟢 | 27 tests, incl. relevance and the trigram fallback |
| Product detail, variants, related products | 🟢 | incl. size ordering |
| Cart add/update/remove/merge | 🟢 | 16 query tests + 6 action tests |
| Addresses CRUD + default rules | 🟠 | 9 tests; **the `updateAddress` "leaves zero defaults" case is untested (BE-05)** |
| Wishlist | 🟢 | 5 tests |
| Checkout action | 🟠 | 4 tests; **no duplicate-submit, no thrown-provider, no product-status case** |
| Order creation + totals | 🟢 | incl. price/stock drift rejection |
| Webhook idempotency | 🟢 | both `fulfillPaidOrder` and `recordPaymentFailure` |
| Stock decrement concurrency | 🟠 | **single-item orders only — the multi-line partial-decrement bug (ECM-01) is exactly what's missing** |
| Refund state machine | 🟠 | `invalid_state` from `pending` is covered; **the provider-called-before-validation ordering (ECM-03) is not** |
| Order status machine as a whole | 🔴 | no transition matrix test; `cancelled` untested because unimplemented |
| Admin CRUD (products/categories/variants/banners/users) | 🟢 | + audit rows + non-admin rejection |
| Admin analytics aggregates | 🟢 | 4 tests incl. the refunded-orders-excluded rule |
| Auth flows | 🟢 | 7 tests |
| `proxy.ts` | 🟢 | 2 tests |
| `requireUser` / `requireAdmin` | 🟢 | 5 tests |
| Email templates + provider selection + wiring | 🟢 | 8 tests |
| Rate limiter | 🟠 | 3 tests of `MemoryRateLimiter`'s window; **`getClientIdentifier` untested (SEC-04)** |
| Storage providers | 🔴 | `packages/storage` has **no tests and no `test` script** |
| **Mock payment actions' authorization** | 🔴 | **SEC-01 — no test asserts a guard exists** |
| **Component behaviour** | 🔴 | **TST-01 — no tooling at all** |
| **Accessibility** | 🔴 | **TST-02 — `axe-core` installed, never run** |
| Security headers | 🔴 | nothing to test yet (SEC-03) |
| Performance / query plans | 🟠 | catalog only |

---

## TST-01 There are no component tests, and the tooling for them does not exist

**Confidence: Confirmed**

### Localização

- `apps/web/vitest.config.ts:7-11` — `environment: "node"`, `include` covers
  `**/*.test.tsx` but no `.test.tsx` file exists
- `apps/web/package.json:36-53` — no `@testing-library/react`, no
  `@testing-library/user-event`, no `@testing-library/jest-dom`, no `jsdom`,
  no `happy-dom`
- `packages/ui/package.json` — no `test` script at all

### Problema

`plan.md` §16 lists as a deliverable:

> *"**Component (Testing Library):** cart drawer, filter panel, variant
> selector, admin forms."*

None of it exists. `apps/web`'s Vitest config runs in the `node` environment,
so a component test could not even mount a component today.

The gap is not academic — it maps directly onto findings in this audit that a
component test would have caught:

| Finding | The component test that would have caught it |
|---|---|
| **FE-01** checkout has no error handling | mount `CheckoutForm`, reject the action, assert an error renders |
| **FE-02** quantity stepper loses updates | mount `CartLineItem`, click `+` twice fast, assert two deltas |
| **FE-13** session expiry → unactionable error | mount with `userEmail` set, return `guest_email_required`, assert the UI offers a path forward |
| **ECM-10** "Thank you" for a refunded order | render the confirmation page with `status: "refunded"` |
| **BE-03** misleading "check the SKU" error | mount `VariantManager`, reject with a non-SKU error |
| **A11Y-01** carousel with no pause | mount `HeroCarousel`, assert a pause control exists |

Every one of the frontend findings in this audit is in a component with zero
test coverage. That is not a coincidence.

### Impacto

- Correção: alto (an entire layer is unverified)
- Manutenção: **alto** (no regression net for the UI; every refactor is manual)
- Segurança: baixo
- UX: alto (the defects that reach users live here)

### Severidade

**P1**

### Recomendação

1. **Add the tooling** (`apps/web/package.json` devDependencies):
   `@testing-library/react`, `@testing-library/user-event`,
   `@testing-library/jest-dom`, `jsdom` (or `happy-dom` — faster, and
   sufficient for these components).
2. **Split the Vitest config** so DB integration tests keep the `node`
   environment and component tests get a DOM. Vitest projects (`test.projects`)
   are the clean way:
   ```ts
   // apps/web/vitest.config.ts
   test: {
     projects: [
       { test: { name: "node", environment: "node", include: ["**/*.test.ts"], exclude: ["**/*.dom.test.ts*"] } },
       { test: { name: "dom",  environment: "jsdom", include: ["**/*.test.tsx"], setupFiles: ["./vitest.setup.ts"] } },
     ],
   }
   ```
   `vitest.setup.ts` imports `@testing-library/jest-dom/vitest`.
3. **Establish the mocking pattern once**, in a shared helper, since every
   component test needs it: mock the Server Action module
   (`vi.mock("@/lib/actions/cart", …)`), `next/navigation`
   (`useRouter`, `usePathname`), and `next/image`. The existing action tests
   already mock `next/headers`, `next/cache` and `next/navigation` — reuse
   those shapes.
4. **Write the highest-value tests first**, in this order:

   | Component | Must assert |
   |---|---|
   | `CheckoutForm` | rejected action → alert + button re-enabled (FE-01); each typed failure reason renders its specific message; `stock_or_price_changed` lists every issue; the displayed total = subtotal + selected shipping; the shipping radio change updates the total |
   | `CartLineItem` | `+`/`−` send the right value; disabled at stock ceiling and at quantity 1; `insufficient_stock` renders the availability message; remove failure renders an error |
   | `ProductVariantPanel` | selecting an out-of-stock variant is impossible; quantity clamps to stock; `out_of_stock` vs `insufficient_stock` render different copy; Add-to-Cart is hidden at zero stock |
   | `HeroCarousel` | renders nothing for an empty list; auto-advances; a pause control stops it (A11Y-01); `prefers-reduced-motion` disables auto-advance |
   | `ProductForm` | slug locked when editing; the unlock confirmation flow; `slug_taken` renders on the slug field |
   | `OrderDetailCard` + confirmation page | each `OrderStatus` renders its correct heading (ECM-10) |
   | `AddressForm` / `AddressBook` | default-checkbox behaviour; delete confirmation once FE-07 lands |
   | `CatalogFilters` | hidden inputs preserve `sort` and `q`; Clear resets |

5. **`packages/ui` needs no tests** — it is thin shadcn wrappers. Don't add a
   suite there; test the composed components in `apps/web` instead.

### Dependências

Blocks nothing, but **FE-01, FE-02, FE-13, ECM-10, A11Y-01 all specify
component tests as their verification** — so land this tooling before those
fixes, or they ship unverified.

### Testes necessários

Self-referential: the deliverable *is* the tests. Acceptance: `pnpm test`
runs both projects, and at least the eight components above have coverage.

---

## TST-02 `axe-core` is installed but never executed; there is no accessibility gate

**Confidence: Confirmed**

### Localização

- `apps/web/package.json:43` — `"axe-core": "^4.12.1"` in devDependencies
- Grep for `axe` across `apps/web/e2e/`, `apps/web/**/*.test.*`,
  `.github/workflows/ci.yml`: **zero matches** outside that manifest line
- `spec.md` §9 — *"Automated `axe-core` scans in CI on key pages as a
  regression guard"*
- `plan.md` §16 — *"**Accessibility (axe-playwright):** automated scan on
  landing, catalog, product detail, cart, checkout, admin product list as a CI
  regression gate"*
- `tasks.md` 10.2 — records a **manual, one-off** axe run: *"`axe-core`
  injected live into the browser and run against every key page"*

### Problema

The Phase 10.2 accessibility pass was real and found four genuine issues
(missing `<main>`, missing `<h1>`s, `CardTitle` rendering a `<div>`). But it
was a **one-time manual injection**, not a gate. The dependency was added and
then never wired to anything. There is nothing preventing the next commit from
reintroducing exactly those four issues.

Concretely, one regression has **already** slipped through since: the hero
carousel (A11Y-01) violates WCAG 2.2.2. That particular rule isn't
machine-detectable — but the scan also never ran against a page *with banners
present*, because the seed creates none, so the whole carousel subtree has
never been scanned at all.

`plan.md` names `axe-playwright` specifically; that package isn't installed
either. The installed `axe-core` is the raw engine, which is what
`@axe-core/playwright` wraps.

### Impacto

- Acessibilidade: alto (a stated AA target with no enforcement)
- Manutenção: alto
- Correção: nenhum
- Segurança: nenhum

### Severidade

**P1**

### Recomendação

1. Add `@axe-core/playwright` (it depends on `axe-core`, which is already
   present).
2. Add `apps/web/e2e/accessibility.spec.ts` scanning the pages `plan.md` §16
   names — landing, catalog, category, product detail, cart, checkout,
   sign-in, and admin product list — with `withTags(["wcag2a","wcag2aa","wcag22aa"])`
   and asserting zero violations.
3. **Seed the data those pages need.** The landing page currently renders no
   hero banners and no promo banners because `seed-catalog.ts` inserts none,
   so the carousel and `PromoSections` have never been scanned. Add at least
   two hero banners and one category banner to the seed (this also makes
   A11Y-01 reproducible and makes the homepage look finished in a demo).
4. Scan **both themes** — `spec.md` §9 requires 4.5:1 contrast *"in both light
   and dark themes"*. Parameterise the spec over
   `page.emulateMedia({ colorScheme })`.
5. Scan the **interactive states** static scanning misses: cart drawer open,
   zoom dialog open, admin form with validation errors displayed. A closed
   `Sheet`/`Dialog` isn't in the DOM, so the default scan proves nothing about
   them.
6. Wire it into the existing `e2e` CI job. It runs only on push to `master`
   today (`ci.yml:84`); accessibility regressions are cheap to catch and
   expensive to find later — consider running the a11y spec on PRs too, since
   it doesn't need the full journey suite.
7. Adopt a **baseline** rather than an all-or-nothing gate if the first run
   surfaces pre-existing violations: record them, fail on new ones. Do not
   disable rules silently.

### Dependências

Independent of TST-01 (this is Playwright, not Testing Library). Should land
*before* A11Y-01's fix so the fix is verified by the gate.

### Testes necessários

Self-referential. Acceptance: CI fails when a known violation is deliberately
reintroduced (e.g. temporarily remove the root `<main>` and confirm red).

---

## TST-03 The critical paths that this audit found broken are the ones with no tests

**Confidence: Confirmed** · **Severidade: P1**

### Problema

Every P0 in this audit sits in a code path with no covering test. That is the
actionable finding: it is not that coverage is low (it isn't), it is that the
*specific* untested cases are the dangerous ones.

| Finding | Why the existing tests miss it |
|---|---|
| **ECM-01** partial stock decrement | Both oversold tests (`orders.test.ts` and `orders-concurrency.test.ts`) use **single-item** orders. The bug only manifests with ≥2 line items. |
| **ECM-02** draft/archived purchasable | Every test fixture creates products with `status: "active"` (`orders.test.ts:57`, `checkout.test.ts:78`). No test ever puts a non-active product in a cart. |
| **SEC-01** unauthenticated mock approval | `mock-checkout.test.ts` (3 tests) verifies the *fulfilment* behaviour. No test asks "should this caller be allowed to?" |
| **DB-06** all-payments update | Every fixture creates exactly one payment row per order. |
| **ECM-03** refund ordering | `orders.test.ts` covers `markOrderRefunded`'s state guard; `apps/web/lib/actions/orders.test.ts` covers the admin gate. Neither asserts the **order of operations** between the provider call and the DB write. |
| **ECM-04** payment succeeded on a non-pending order | No test puts an order in a non-`pending` state before fulfilling. |
| **BE-01** `NaN` page → 500 | No test passes a non-numeric `page`. |
| **BE-04** deleting the last variant | `admin-variants.test.ts` deletes a variant from a **two**-variant product. |
| **BE-05** `updateAddress` clears the default | `addresses.test.ts` covers create/promote/delete-promotion. The single-address-edit case is absent. |
| **SEC-04** spoofable rate-limit key | `checkout.test.ts:43` mocks `headers()` to return `{ get: () => null }`, so `getClientIdentifier` always returns `"unknown"` and its parsing logic is never exercised. |

### Recomendação

Treat the test list attached to each finding as **part of that finding's
definition of done**. Do not mark a fix complete without them.

The five highest-value additions, in order:

1. **Multi-line oversell** (`packages/db/src/queries/orders.test.ts`) — three
   variants: short line last, short line first, and a real-connection
   concurrent version. Assert stock on the *uncontended* variant is unchanged
   and zero `inventory_log` rows reference the order.
2. **Product status enforcement** (`orders.test.ts` + `cart.test.ts`) — a
   `draft` variant cannot be added; an `archived` product in a cart blocks
   checkout with an `unavailable` issue.
3. **Mock-action authorization** (`apps/web/lib/actions/mock-checkout.test.ts`)
   — with `PAYMENT_PROVIDER=stripe` both actions reject and mutate nothing;
   with `mock`, a non-owner rejects.
4. **Order status transition matrix** (new file,
   `packages/db/src/domain/order-status.test.ts` per ARCH-05) — all 25
   from/to pairs, plus one integration test per legal transition asserting the
   audit row.
5. **Payment-row targeting** (`orders.test.ts`) — two payment rows per order;
   assert fulfilment and refund each touch exactly one.

### Testes necessários

The list above **is** the deliverable.

---

## TST-04 The `unique()` test-id helper is `Date.now()`-based and is a known flake source

**Confidence: Confirmed** · **Severidade: P2**

### Localização

Duplicated in at least six files, e.g.
`packages/db/src/queries/orders.test.ts:29-33`,
`orders-concurrency.test.ts:17-21`,
`apps/web/lib/actions/checkout.test.ts:50-54`:

```ts
let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}
```

### Problema

`counter` is **module-scoped**, so it only disambiguates within a single test
file. Vitest runs files in parallel worker processes by default. Two files
starting in the same millisecond both produce `cat-1754700000000-1`, which
collides on `category_slug_unique` / `product_slug_unique` /
`product_variant_sku_unique` / `user_email_unique`.

This is already documented as observed flake in `tasks.md` Phase 7.12:

> *"the `unique()` test-id helper used across the suite is `Date.now()`-based
> and occasionally collides under parallel test-file execution — confirmed
> flaky (passes clean on rerun)"*

It was acknowledged and never fixed. A flaky suite is worse than a smaller
one: it trains everyone to re-run rather than investigate, which is exactly
how a real regression gets waved through.

The `apps/web` tests make this worse: several of them use the **real** `db`
pool with manual `afterAll` cleanup (`checkout.test.ts:101-115`,
`orders-concurrency.test.ts:36-49`) rather than the rollback helper. If a test
fails before its cleanup runs, rows leak into the next run and can collide.

### Recomendação

1. Replace with `randomUUID()`:
   ```ts
   // packages/db/src/test/unique.ts  — one implementation, exported
   import { randomUUID } from "node:crypto";
   export const unique = (prefix: string) => `${prefix}-${randomUUID()}`;
   ```
   Export it from `@medivi/db/test` and delete all six copies.
2. Where the value must be short (SKU), use `randomUUID().slice(0, 8)`.
3. For the tests that use the real pool, prefer `withTestTransaction` unless
   the test genuinely needs concurrent connections (only
   `orders-concurrency.test.ts` and the auth tests do). Where the real pool is
   required, make cleanup `try/finally`-safe so a failing assertion still
   cleans up.
4. Add a CI step that fails if the suite leaves rows behind: after
   `pnpm test`, assert the row counts for `category`/`product`/`user` match the
   seed.

### Testes necessários

Run `pnpm test` 20 times in a loop; zero failures. (A `--repeat` flag exists in
Vitest 4 — use it locally rather than adding it to CI.)

---

## TST-05 E2E coverage gaps

**Confidence: Confirmed** · **Severidade: P2**

### Localização

`apps/web/e2e/` — 3 spec files, 4 tests total.

### Problema

`plan.md` §16 specifies the E2E scope as *"full purchase journey, auth journey
(sign up/in/out, guest→account cart merge), admin CRUD journey, **wishlist
add/remove**"*. Three of four exist; wishlist does not.

Beyond the stated scope, the flows with **no** end-to-end coverage are exactly
the failure paths:

| Untested flow | Why it matters |
|---|---|
| **Payment decline** | `declineMockPayment` exists and is unit-tested, but no E2E verifies the customer lands back with an intact cart and a usable retry — the behaviour `tasks.md` 5.9 describes as a real bug it fixed |
| **Out-of-stock at checkout** | The itemised `stock_or_price_changed` UI has never been rendered in a browser |
| **Price change at checkout** | Same |
| **Guest order lookup** | `/orders/lookup` — unit-tested, never driven |
| **Address book** | Create/edit/delete/default-promotion — no E2E |
| **Forgot/reset password** | The full round trip is only verified manually (`tasks.md` 8) |
| **Wishlist add/remove** | Explicitly in scope, not built |
| **Search** | The header search bar's debounce/navigate behaviour |
| **Mobile viewport** | `playwright.config.ts:25` runs only `Desktop Chrome`; `spec.md` §11 sets Core Web Vitals targets on a *mobile* profile and §5.16 requires a responsive layout. The mobile nav, drawer and filters have never been driven by a test |

Config observations:
- `fullyParallel: false` + `workers: 1` — deliberate (shared DB), correct, but
  it means the suite time grows linearly. At 4 tests that's fine.
- `globalSetup` TRUNCATEs and reseeds (`e2e/fixtures/seed.ts:41-46`). Tests
  therefore share mutable state and **must** run in order. `admin-journey`'s
  second test creates a paid order that changes stock for later runs — the
  TRUNCATE makes that safe across runs, not within one.
- E2E runs **only on push to `master`** (`ci.yml:84`). A PR can break the
  purchase journey and merge green.

### Recomendação

1. Add the wishlist spec (in scope, missing).
2. Add a **failure-path spec**: decline, out-of-stock-at-checkout,
   price-changed-at-checkout. These are the flows this audit shows are
   fragile; they need a browser-level guard.
3. Add a **mobile project** to `playwright.config.ts` (`devices["Pixel 7"]`)
   running at least the purchase journey.
4. Add guest order lookup and the password-reset round trip (the console email
   provider logs the link — the spec can read it from the server logs, or
   better, expose a test-only hook).
5. **Run E2E on PRs.** `plan.md` §18 chose master-only to save CI minutes;
   with 4–8 tests at ~2 minutes that trade is no longer worth it. At minimum
   run the purchase journey + the a11y spec (TST-02) on PRs.
6. Reduce coupling to seed data: `purchase-journey.spec.ts` hardcodes
   `iron-longsword`, `steel-broadsword`, `wooden-buckler` and the material
   `Iron`. Export those as named constants from `e2e/fixtures/seed.ts` so a
   seed change breaks the fixture, not three specs.

### Testes necessários

The list above.

---

## TST-06 `packages/storage` has no tests and no test script

**Confidence: Confirmed** · **Severidade: P3**

### Localização

`packages/storage/` — contains `vitest.config.ts` but **no `*.test.ts` files**,
and `packages/storage/package.json` has no `test` script (verified: `turbo run
test` skips it silently).

### Problema

Every other provider package is tested: `payments` (9), `email` (4),
`ratelimit` (3). `storage` has zero. It contains real logic worth testing:

- `sanitizeFilename` (`s3.ts:14-16`) — the security-relevant part
- the URL construction `${endpoint}/${bucket}/${key}` — **the source of CFG-02**
- `delete`'s key extraction `new URL(url).pathname.replace('/${bucket}/','')` —
  fragile; a URL from a *different* provider silently produces a wrong key and
  deletes nothing (or the wrong object)

CFG-02 (self-host image URLs pointing at `minio:9000`) would have been caught
by a single unit test asserting what `upload` returns.

### Recomendação

Add `packages/storage/src/providers/s3.test.ts` with the S3 client mocked:

- `upload` returns a URL of the expected shape and prefixes a UUID
- `sanitizeFilename` strips `/`, `\`, `..`, spaces, unicode
- `delete` extracts the correct key from a URL this provider produced
- `delete` on a URL this provider did **not** produce is rejected rather than
  silently computing a wrong key
- add the `"test": "vitest run"` script so `turbo run test` picks it up

Once CFG-02 lands (separate public/internal endpoints), add a test asserting
`upload` returns the **public** endpoint.

---

## TST-07 Test-environment gaps that hide real behaviour

**Confidence: Confirmed** · **Severidade: P3**

Small but worth fixing, because each one means a code path is never exercised:

| Gap | Localização | Effect |
|---|---|---|
| `getClientIdentifier` never sees a real header | `checkout.test.ts:43` mocks `headers()` as `{ get: () => null }` | The XFF parsing (SEC-04) is unexecuted by any test |
| Better Auth rate limiting is production-only | `lib/auth.ts:53-59` | No test can ever exercise sign-in throttling (SEC-13) |
| CI never sets `STORAGE_PROVIDER` / S3 vars | `.github/workflows/ci.yml:51-58` writes only 4 vars | `getStorageProvider()` would throw if reached; no test reaches it, so the failure is invisible until an E2E test uploads an image |
| CI never sets `EMAIL_PROVIDER` | same | Defaults to `console` — fine, but the `resend` branch is only covered by `email.test.ts`'s env manipulation |
| No test asserts `PAYMENT_PROVIDER` gating | — | SEC-01 |
| The E2E suite runs only chromium | `playwright.config.ts:25` | No Firefox/WebKit; `has-[:checked]` selectors and `overflow-x` behaviour differ |
| `packages/ui` has no `test` script | `packages/ui/package.json` | Fine (thin wrappers) — but `turbo run test` reporting "4 packages" hides that it's really 5 workspaces |

**Recomendação:** add the missing env vars to CI so the provider-selection
code paths are at least constructible; add one Firefox project to Playwright;
give the rate-limit identifier its own unit test with a real headers stub.
