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

- [ ] 4.1 Wishlist data layer (add/remove/list)
- [ ] 4.2 Wishlist UI (toggle on product card + detail, `/wishlist` page)
- [ ] 4.3 Cart data layer: guest cookie-token cart + user cart + merge-on-login
- [ ] 4.4 Add-to-cart server action with stock validation
- [ ] 4.5 Cart drawer/page UI: quantity stepper, remove, subtotal, empty state
- [ ] 4.6 Tests: guest→login cart merge (sum + clamp to stock), quantity update, removal, add-to-cart blocked when out of stock
- **Validation:** add items as guest, sign in, cart merges correctly with stock-aware clamping; wishlist persists per user.

## Phase 5 — Checkout & Payments

- [ ] 5.1 Define `PaymentProvider` interface in `packages/payments`
- [ ] 5.2 Implement `MockProvider` (internal approve/decline page, same fulfillment code path as Stripe)
- [ ] 5.3 Implement `StripeProvider` (Checkout Session creation, test-mode keys)
- [ ] 5.4 Checkout page: address form, flat-rate shipping method, order summary
- [ ] 5.5 `createOrder` server action: re-validate stock/price, create `Order`+`OrderItem`s (status `pending`) in one transaction
- [ ] 5.6 Stripe webhook route: signature verification, `ProcessedWebhookEvent` idempotency check, transactional status update + stock decrement + `InventoryLog`
- [ ] 5.7 Order confirmation page: pending/paid/failed states
- [ ] 5.8 Refund server action (admin-triggered; enforces valid source states)
- [ ] 5.9 Tests: checkout total calculation, webhook idempotency (duplicate event is a no-op), **concurrent checkout race on single-unit stock** (exactly one success), mock-provider E2E happy path, invalid webhook signature rejected
- **Validation:** full purchase with `MockProvider` reaches `paid` and sends a confirmation email (console provider); duplicate webhook delivery doesn't double-fulfill; concurrency test passes.

## Phase 6 — Orders & Account

- [ ] 6.1 Account layout + nav (profile, addresses, orders)
- [ ] 6.2 Address book CRUD
- [ ] 6.3 Order history list (authenticated) + order detail page
- [ ] 6.4 Guest order lookup (order id + email, emailed link)
- [ ] 6.5 Tests: a user cannot view another user's order by guessing an id
- **Validation:** signed-in user sees only their own orders; guest can retrieve their order via the emailed lookup link.

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
