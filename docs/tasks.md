# Medivi Shop — Task Breakdown

Status: Draft v1.0
Last updated: 2026-07-25

Ordered by dependency, grouped into phases. Each task is scoped to be
implementable and testable in isolation — no task should require touching
more than a handful of files. Checkboxes track progress across sessions.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

## Phase 0 — Project Scaffolding

- [x] 0.1 Init pnpm workspace + Turborepo (`pnpm-workspace.yaml`, `turbo.json`, root `package.json`)
- [x] 0.2 Create `packages/config` (shared `tsconfig/base.json`, ESLint flat config)
- [x] 0.3 Scaffold `apps/web` (Next.js 16, App Router, TypeScript strict, Tailwind v4)
- [x] 0.4 Add shadcn/ui to `packages/ui`; install base primitives (button, input, label, card, dialog, sheet, dropdown-menu, toast/sonner, skeleton, badge, tabs, table, select, checkbox, separator)
- [x] 0.5 Wire dark mode (`next-themes`) + define Medivi color/typography tokens; verify contrast ratios
- [x] 0.6 Write `docker/docker-compose.yml` (Postgres, Redis, MinIO) for local dev
- [x] 0.7 Add typed env schema (`apps/web/lib/env.ts`) + `.env.example`
- [x] 0.8 Add GitHub Actions CI skeleton: install → lint → typecheck → build (no tests yet)
- **Validation:** `pnpm install && pnpm lint && pnpm typecheck && pnpm build` all succeed (verified locally, mirrors CI). `docker compose up` was reviewed but not executed — Docker isn't available in the sandbox this was built in; verify it on a machine with Docker before starting Phase 1.

## Phase 1 — Database & Domain Model

- [x] 1.1 Set up `packages/db` (Drizzle + `postgres-js` driver + `drizzle-kit` config)
- [x] 1.2 Schema: `User`, `Account`, `Session`, `Verification` (Better Auth tables) + migration
- [x] 1.3 Schema: `Category` (self-referencing parent) + migration
- [x] 1.4 Schema: `Product`, `ProductImage`, `ProductVariant` + migration + FTS `tsvector`/GIN index
- [x] 1.5 Schema: `Address` + migration
- [x] 1.6 Schema: `Cart`, `CartItem` + migration
- [x] 1.7 Schema: `Order`, `OrderItem` + migration
- [x] 1.8 Schema: `Payment`, `ProcessedWebhookEvent` + migration
- [x] 1.9 Schema: `Wishlist`, `WishlistItem` + migration
- [x] 1.10 Schema: `Banner`, `FeatureFlag` + migration
- [x] 1.11 Schema: `InventoryLog`, `AuditLog`, `AnalyticsEvent` + migration
- [x] 1.12 Write seed script: categories (Swords, Shields, Armor > Helmets/Chestplates, Cloaks, Relics, Potions, Banners), 36 products with variants/stock/placeholder images, one seed admin user
- [x] 1.13 Add test DB helper (per-test transaction rollback) for integration tests
- **Validation:** `pnpm lint && pnpm typecheck` clean workspace-wide. `drizzle-kit migrate` applied the 22-table migration to the local Docker Postgres cleanly; `tsx src/seed.ts` populated 9 categories / 36 products / 72 variants / 36 images / 1 admin user, counts verified directly in `psql`. Full-text search (`websearch_to_tsquery`) and the `stock >= 0` check constraint (rejects a manual negative-stock update) were both spot-checked against the live database.

## Phase 2 — Auth

- [x] 2.0 Set up Vitest (not originally its own line item — added as a prerequisite; 1.13's test helper and this phase's task tests need a real runner, and Phase 11 only covers Playwright/CI wiring, not the base unit-test setup)
- [x] 2.1 Configure Better Auth core (email/password) with Drizzle adapter — schema reconciled against `npx @better-auth/cli generate` (added missing indexes, `$onUpdate` triggers, `NOT NULL` on `verification` timestamps; see migration `0001_reconcile_auth_with_better_auth.sql`)
- [ ] 2.2 ~~Add GitHub OAuth provider config~~ — **deferred** (2026-07-25): user opted to ship email/password only for now; requires registering a GitHub OAuth App first. Revisit whenever OAuth is wanted — the Better Auth config in `apps/web/lib/auth.ts` takes a provider addition without touching the schema (`account` already has `providerId`/`accessToken`/etc.).
- [x] 2.3 Build sign-up page + form (React Hook Form + Zod)
- [x] 2.4 Build sign-in page + form
- [x] 2.5 Add session-aware header (sign in/out state, user menu)
- [x] 2.6 Add `proxy.ts` guarding `/account/**` and `/admin/**` — Next.js 16 renamed `middleware.ts` → `proxy.ts` (default export/`proxy` export, Node.js runtime by default now); cookie-presence check only, not full session validation
- [x] 2.7 Add `requireAdmin()`/`requireUser()` server-side helpers for use inside every protected server action
- [ ] 2.8 Tests: sign-up validation errors, sign-in success/failure, session persists across reload, proxy redirect for unauthenticated access
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass workspace-wide (15 tests: 4 DB-constraint tests in `packages/db` against live Postgres, 11 in `apps/web` incl. real sign-up/sign-in against the live DB, guard-redirect unit tests, and `proxy.ts` cookie-presence tests). Verified live in the browser: sign up, session-aware header swaps to the account menu, sign out, and `curl`-level checks that `/account`/`/admin/*` redirect to `/sign-in` unauthenticated but pass through with a session cookie. Also found and fixed a real production-build bug along the way — `NODE_ENV=development` in `.env` was leaking into `next build` via the `dotenv-cli` wrapper, corrupting React's dev/prod bundle selection (see CLAUDE.md § Environment gotchas).

## Phase 3 — Product Catalog

- [x] 3.1 Product query layer: list with pagination + filters + sort (plain functions in `packages/db`, unit-testable without HTTP) — also added `product.isFeatured` (documented in `docs/plan.md` §10 as a "featured flag" but missing from the actual schema; see migration `0002_bright_ultragirl.sql`)
- [x] 3.2 Category navigation (header menu, sidebar on catalog) — built together with 3.3 since the sidebar needed the catalog page to mount in
- [x] 3.3 Catalog page: grid, pagination, loading skeleton, empty state — `/catalog` and `/catalog/[category]` (404s on an unknown slug), default sort is featured-first
- [x] 3.4 Filter UI (category/price range/material/in-stock) synced to URL search params — category via route (`/catalog/[category]`), price/material/in-stock via a native GET form (no client JS required)
- [x] 3.5 Sort UI (price asc/desc, newest, featured) — native GET form, preserves active filters via hidden inputs
- [x] 3.6 Search: FTS + trigram query function, search bar (debounced), empty-results state — `word_similarity` (not plain `similarity`) for the fuzzy fallback, since `similarity` dilutes a short query against a multi-word name; enabled via migration `0003_nice_nicolaos.sql` (`pg_trgm` extension + trigram GIN index)
- [x] 3.7 Product detail page: gallery, description, variant selector, stock badge — sized variants (S/M/L/XL) reordered by garment size, not the alphabetical DB order
- [x] 3.8 Image gallery component (thumbnails, keyboard navigation, zoom) — built together with 3.7, same reasoning as the 3.2/3.3 pairing
- [x] 3.9 Related products section (same-category query) — built together with 3.7
- [x] 3.10 Tests: filter/sort query correctness, search relevance on seed data, no N+1 queries on listing (query-count assertion) — `withTestTransaction` gained an optional `onQuery` hook (postgres.js `debug` callback) to make the query-count assertion possible; asserts query count doesn't grow between 5 and 20 result rows, rather than pinning an exact number
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass workspace-wide (32 tests in `packages/db` covering filter/sort/pagination/search/category-tree/product-detail/related-products correctness, plus the N+1 query-count assertion, all against a real Postgres). Verified live in the browser end-to-end: header category dropdown, `/catalog` and `/catalog/[category]` grids with combined price/material/in-stock filters and sort (all synced to URL params, survive reload), search bar (debounced, typo-tolerant via `pg_trgm`), empty states for both "no filter results" and "no search results", a product detail page with size-ordered variant selector, live stock badge, image zoom (Escape closes it), related products, and 404s for unknown category/product slugs. Also found and fixed two real bugs along the way: (1) a hand-written `sql` subquery whose column references came out unqualified, silently matching the wrong table's `id` column and making `inStock`/`imageUrl` always resolve to `false`/`null` — fixed by building those subqueries through the query builder instead of raw `sql` interpolation; (2) `similarity()`'s fuzzy-search fallback diluting short queries against multi-word names — fixed by switching to `word_similarity()`. Unrelated to the app itself: repeatedly hit "sorry, too many clients already" against the local Postgres during this phase, traced to the Next dev server's Turbopack HMR re-creating `packages/db`'s module-level `postgres()` connection pool on every file edit without closing the old one — stopping the dev server before bulk `pnpm test` runs and restarting `docker restart medivi-shop-postgres-1` cleared it each time; worth a real fix (e.g. a global-scoped client keyed off `globalThis` in dev) if it keeps recurring in later phases.

## Phase 4 — Wishlist & Cart

- [x] 4.1 Wishlist data layer (add/remove/list) — `addToWishlist`/`removeFromWishlist` idempotent via `onConflictDoNothing`, `getWishlistedProductIds` for a batch membership check (no per-card query), `listWishlistProducts` for the `/wishlist` page reusing the catalog's image/stock subqueries
- [x] 4.2 Wishlist UI (toggle on product card + detail, `/wishlist` page) — toggle button lives as an absolutely-positioned sibling of the card's `<Link>` (not nested inside it) to avoid an invalid button-inside-anchor; hidden for guests; `/wishlist` added to `proxy.ts`'s matcher alongside `/account` and `/admin`
- [x] 4.3 Cart data layer: guest cookie-token cart + user cart + merge-on-login — also added a missing `unique()` on `cart.userId` (migration `0004_windy_riptide.sql`; the schema only enforced one-cart-per-guest-token, not one-cart-per-user)
- [x] 4.4 Add-to-cart server action with stock validation — added update-quantity/remove/merge-on-login actions alongside it (same file, same owner-resolution helpers); guest cart cookie is HMAC-signed per the `docs/plan.md` §6 addendum; merge-on-login wired into both the sign-in and sign-up form success handlers
- [x] 4.5 Cart drawer/page UI: quantity stepper, remove, subtotal, empty state — drawer in the header (Sheet) shares `CartLineItem`/`CartSummary` with the full `/cart` page; "Add to Cart" quantity stepper + button added to the product detail page's variant panel
- [x] 4.6 Tests: guest→login cart merge (sum + clamp to stock), quantity update, removal, add-to-cart blocked when out of stock — written alongside 4.3/4.4 (`packages/db/src/queries/cart.test.ts`, `apps/web/lib/actions/cart.test.ts`) rather than deferred, per CLAUDE.md's "test before marking a task done"
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass workspace-wide (69 tests: 52 in `packages/db` incl. cart/wishlist query correctness and the merge-on-login sum+clamp logic, 17 in `apps/web` incl. the cart Server Actions with a real guest cookie round-trip). Verified live end-to-end: added an item to the cart as a guest (confirmed a real `cart` row keyed by the signed httpOnly cookie token, invisible to `document.cookie`/JS as intended), the drawer's quantity stepper/remove/subtotal all update live and reflect in the header badge, the standalone `/cart` page mirrors the drawer, then signed up a fresh account and confirmed in Postgres that the guest cart's item moved onto the new user's cart with the guest cart row deleted — the actual Phase 4 acceptance criterion, not just the unit tests. Also fixed a real schema gap (`cart.userId` had no unique constraint) and a real cross-file bug (`Array value must start with "{"` from passing a raw JS array to a hand-written `sql\`= any(...)\`` instead of drizzle's `inArray()`).

## Phase 5 — Checkout & Payments

- [x] 5.1 Define `PaymentProvider` interface in `packages/payments` — `createCheckoutSession`/`verifyAndParseWebhook`/`refund`; `verifyAndParseWebhook` throws on a bad/missing signature so callers turn that into a clean 4xx
- [x] 5.2 Implement `MockProvider` — no network calls; the order's own uuid doubles as the mock checkout token (already unguessable, and this path only ever runs with `PAYMENT_PROVIDER=mock`); approve/decline call `fulfillPaidOrder`/`recordPaymentFailure` directly — the exact same functions the Stripe webhook route calls
- [x] 5.3 Implement `StripeProvider` — Checkout Sessions API (`stripe` npm package, v22); webhook verification via `stripe.webhooks.constructEvent`; on `checkout.session.completed` the `providerRef` stored going forward is the Stripe **payment_intent** id (not the session id), since that's what refunds actually need later
- [x] 5.4 Checkout page (`/checkout`) — guest-or-authenticated email, shipping address form, two flat-rate shipping options (native radios, no client JS required to render), live order summary — React Hook Form + Zod, schema shared with the server action (`lib/schemas/checkout.ts`)
- [x] 5.5 `createOrder` query + `checkoutAction` server action — re-validates every cart line against *live* stock/price (not the cart's snapshot) inside `packages/db`; a mismatch on any line blocks checkout with itemized issues instead of silently charging a different total; creates `Order` (`pending`) + `OrderItem`s in one transaction, then hands off to `PaymentProvider.createCheckoutSession`
- [x] 5.6 Stripe webhook route (`/api/webhooks/stripe`) — signature verified before anything else; idempotent via `ProcessedWebhookEvent` (keyed by `event.id`); stock decrement uses a guarded `UPDATE ... WHERE stock >= quantity` inside the same transaction as the status update — this is the actual concurrency backstop, not just the add-to-cart clamp
- [x] 5.7 Order confirmation page (`/order/confirmation/[id]`) — pending/paid/failed UI states (failed = `order.status` still `pending` but latest `payment.status = failed`, so a "Try again" link goes straight back to the still-populated cart); a small client poller (`router.refresh()` every 2s for 20s) covers the case where the webhook lags the redirect; reachable by unguessable order id with no ownership check by design (same pattern as an emailed receipt link) — the authenticated order-history detail page in Phase 6 is the one that must enforce ownership
- [x] 5.8 `refundOrderAction` — admin-only (`requireAdmin()` re-checked in the action itself), only valid from `paid`/`fulfilled` payment state, calls `PaymentProvider.refund` before the DB transition and writes an `AuditLog` row
- [x] 5.9 Tests — 25 new tests across `packages/payments` (Stripe signature verification incl. tampered/missing signature, mock provider), `packages/db` (checkout total calculation, price/stock drift rejection, webhook idempotency, refund state machine), and `apps/web` (checkout action, mock approve/decline, the actual webhook route handler called with a real `Request`) — plus a dedicated **real-connection concurrency test** (`orders-concurrency.test.ts`, deliberately not using the single-connection `withTestTransaction` helper) firing two genuinely concurrent `fulfillPaidOrder` calls at a stock-1 variant and asserting exactly one comes back `paid` and the other `oversold`, stock never negative
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass workspace-wide (109 tests total: 9 in `packages/payments`, 67 in `packages/db` incl. the concurrency test, 33 in `apps/web`). Verified live in the browser end-to-end with the mock provider: added an item as a guest, checked out, approved on the mock payment page, landed on the confirmation page showing `paid` with correct totals/address, and confirmed in Postgres the stock decrement + inventory log row. Separately verified the decline path redirects back to `/checkout` with the order confirmation page's cart-clearing semantics correct. Two real bugs found and fixed along the way: (1) `export type { CheckoutInput }` from a `"use server"` action file crashed Next's dev-mode server-actions bundler (`ReferenceError: CheckoutInput is not defined`) — production `next build` didn't catch this since it doesn't exercise the dev bundler path; fixed by having the client form import the type from its actual home (`lib/schemas/checkout.ts`) instead of re-exporting it through the action file. (2) `createOrder` was clearing the cart at order-*creation* time rather than at payment-*success* time, which meant a declined or abandoned payment left the customer with an empty cart and no way to retry — directly contradicting the documented edge case in docs/spec.md §7 ("user can retry from the confirmation/cart page"); fixed by moving the cart-clear into `fulfillPaidOrder`'s success path only, verified live via the decline flow leaving the cart populated.

## Phase 6 — Orders & Account

- [x] 6.1 Account layout + nav (profile, addresses, orders) — `/account` layout with a shared `AccountNav`; each page re-checks `requireUser()` itself rather than trusting a layout-level guard, consistent with the rest of the app
- [x] 6.2 Address book CRUD — first address is always the default regardless of the input flag; creating/editing a new default demotes the old one; deleting the default promotes the next-most-recent remaining address — all enforced transactionally in `packages/db`, not just in the UI. Checkout still uses its own inline address form and doesn't yet offer "pick a saved address" (noted as a follow-up, not built this phase — out of this task's listed scope)
- [x] 6.3 Order history list (authenticated) + order detail page — `getOrderForUser` returns `null` for both a nonexistent order and someone else's order (same 404 either way, so a guess reveals nothing); extracted the item/summary/address markup shared with the checkout confirmation page into `OrderDetailCard`
- [x] 6.4 Guest order lookup — `/orders/lookup`, matches on **both** order number and guest email (not just an unguessable id, since this is the durable "come back later" path); no email sending yet (Phase 8), so this is a manual lookup form rather than an emailed link, linked from the sign-in page
- [x] 6.5 Tests: access control — `getOrderForUser` unit-tested for the cross-user case; verified live in the browser end-to-end (see below)
- **Validation:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass workspace-wide (131 tests: 84 in `packages/db`, 38 in `apps/web`, 9 in `packages/payments`). Verified live in the browser: added an address and confirmed first-address/default-promotion behavior, placed an order, saw it in order history and its detail page, then signed in as a *second*, unrelated account and confirmed hitting the first account's order-detail URL directly returns a 404 — the actual Phase 6 acceptance criterion, not just the unit test. Also completed a full guest checkout → mock-approve → guest lookup round trip (wrong email correctly rejected, correct order number + email found it). Found and fixed three real bugs along the way, all pre-existing in already-shipped code from earlier phases: (1) the exact same "unqualified column reference in a raw `sql` subquery" bug from Phase 3 had recurred in `cart.ts`'s `imageUrl` subquery — `product_image` has its own `id` column that silently shadowed the intended `product.id` reference, so cart line items never showed a product image; fixed by building the subquery through the query builder, like the Phase 3 fix. (2) The same unqualified-reference bug in this phase's own new `listOrdersForUser` item-count subquery — rewritten as a `leftJoin` + `groupBy` instead of a scalar subquery. (3) `fulfillPaidOrder` only ever cleared the cart for authenticated users (looked it up by `userId`) — a guest's cart was never cleared after a successful purchase, since nothing recorded which cart an order came from. Fixed by adding `order.cartId` (migration `0005_previous_lady_ursula.sql`) and clearing by that instead of by `userId`; verified live by completing a real guest purchase and watching the header's cart badge correctly drop to 0.

## Phase 7 — Admin Dashboard

- [ ] 7.1 Admin layout + nav + role guard
- [ ] 7.2 Product list + create/edit form (image upload via `StorageProvider`) + soft-delete
- [ ] 7.3 Variant management + stock adjustment (writes `InventoryLog`)
- [ ] 7.4 Category CRUD (parent/child), delete blocked while products are assigned
- [ ] 7.5 Order list + detail + status transition (`paid → fulfilled`) + refund trigger
- [ ] 7.6 Banner/promotion CRUD with placement + active date range
- [ ] 7.7 Analytics dashboard: revenue over time, top products, low-stock alerts, recent orders
- [ ] 7.8 Audit log viewer (read-only, filterable by actor/entity)
- [ ] 7.9 User role management (promote/demote admin)
- [ ] 7.10 Tests: every admin mutation writes an `AuditLog` row; non-admin gets rejected server-side even if UI is bypassed
- **Validation:** an admin can fully manage catalog, orders, banners, and users; a non-admin hitting an admin server action directly (bypassing UI) is rejected.

## Phase 8 — Emails

- [ ] 8.1 `packages/email`: React Email templates (order confirmation, welcome, verify-email, password reset)
- [ ] 8.2 `EmailProvider` interface + `ResendProvider` + `ConsoleEmailProvider`
- [ ] 8.3 Wire order-confirmation email into the webhook fulfillment path
- [ ] 8.4 Wire welcome/verification/password-reset emails into auth flows
- [ ] 8.5 Tests: template rendering snapshot tests, provider selection via env var
- **Validation:** in local dev (`EMAIL_PROVIDER=console`), every triggering action logs a fully-rendered email.

## Phase 9 — Landing Page & Content

- [ ] 9.1 Landing page: hero banner rotation, featured categories, featured products, promo sections
- [ ] 9.2 Footer: nav links, legal placeholder pages, newsletter signup (UI-only, no backend)
- [ ] 9.3 SEO: `generateMetadata` per page, JSON-LD (`Product`, `BreadcrumbList`, `Organization`), `sitemap.xml`, `robots.txt`
- [ ] 9.4 404 page + route-segment `error.tsx` boundaries (storefront/account/admin)
- **Validation:** Lighthouse SEO ≥ 90 on landing/catalog/product pages; sitemap includes all published products/categories.

## Phase 10 — Cross-Cutting Polish

- [ ] 10.1 Audit loading/error/empty states across all routes for consistency
- [ ] 10.2 Accessibility pass: automated `axe-core` scan + manual keyboard/screen-reader spot check
- [ ] 10.3 Sentry integration (client + server)
- [ ] 10.4 Structured logging (pino) across server actions/route handlers
- [ ] 10.5 Rate limiting (Upstash) on auth + checkout + webhook endpoints
- [ ] 10.6 Performance pass: Lighthouse/Core Web Vitals on key pages, image sizing audit
- **Validation:** Lighthouse Performance + Accessibility ≥ 90 on `/`, `/catalog`, `/product/[slug]`; axe scan reports zero critical violations.

## Phase 11 — Testing & CI/CD Completion

- [ ] 11.1 Playwright E2E: full purchase journey (browse → filter → detail → cart → checkout via mock → confirmation)
- [ ] 11.2 Playwright E2E: auth journey (sign up, sign in, guest cart merge)
- [ ] 11.3 Playwright E2E: admin CRUD journey (product, category, banner, order status)
- [ ] 11.4 Wire Playwright into CI against an ephemeral Postgres + `PAYMENT_PROVIDER=mock`
- [ ] 11.5 Enable Dependabot + `npm audit`/`pnpm audit` CI step
- [ ] 11.6 Finalize production `Dockerfile` (multistage) + `docker-compose.prod.yml`
- [ ] 11.7 Configure Vercel project (env vars, preview deployments) + Neon/Upstash/Blob/Resend wiring
- [ ] 11.8 Write a short deployment runbook (`docs/runbook.md`): how to deploy, rotate secrets, run migrations, roll back
- **Validation:** CI is green on a clean PR (lint, typecheck, unit, E2E, build); a fresh clone deploys following only the runbook, no undocumented steps.

## Dependency Notes

- Phase 1 (DB) blocks everything else — all later phases read/write these tables.
- Phase 2 (Auth) blocks Wishlist, Account, Admin (all need a user/role concept).
- Phase 3 (Catalog) blocks Cart (needs products to add) and Checkout (needs order items).
- Phase 5 (Checkout/Payments) blocks Phase 6 (Orders/Account order history) and Phase 8 (order-confirmation email).
- Phase 7 (Admin) depends on Phase 1, 2, 3, and partially 5 (order management) and 9 (banners feed the landing page).
- Phase 10 and 11 are cross-cutting and can start incrementally alongside earlier phases (e.g., add axe scans as each page ships) rather than strictly waiting until the end — the ordering above reflects when they can be *completed*, not when they must *start*.
