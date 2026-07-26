# Medivi Shop — Product Specification

Status: Draft v1.0
Owner: Felipe Borges (portfolio project)
Last updated: 2026-07-25

## 1. Product Vision

Medivi Shop is a fictional medieval/fantasy-themed e-commerce storefront: swords,
shields, armor, cloaks, relics, potions, and banners sold to adventurers who
take their gear seriously. No real products, no real payments — but every flow
(browsing, cart, checkout, order lifecycle, admin operations) is built to the
standard of a real commercial store, so the project can stand in for
production experience in a portfolio or freelance pitch.

The product goal is not "an online store demo." It's "a store a small
merchant guild could actually run," including the boring-but-critical parts:
inventory tracking, order state machines, audit logs, and email
notifications — the things that separate a CRUD toy from a credible system.

## 2. Target Users

| Persona | Description | Primary needs |
|---|---|---|
| **Adventurer (customer)** | Browses and buys gear. Not tech-savvy; wants fast browsing, clear pricing, trustworthy checkout. | Search/filter, clear stock status, guest checkout option, order tracking, wishlist for later. |
| **Guild Quartermaster (admin)** | Runs the shop's catalog and fulfillment. | Product/category CRUD, stock control, order management, promotional banners, sales visibility. |
| **Portfolio reviewer (secondary)** | A hiring manager or client evaluating the code/product. | Evidence of engineering judgment: clean architecture, tests, real-world edge cases handled, not just a "happy path" demo. |

Medivi Shop is explicitly **not** building for anonymous high-traffic public
launch — it's a single-region, single-currency, single-tenant store.

## 3. User Journeys

### 3.1 Guest browsing → purchase
1. Land on homepage → see hero banner, featured categories, featured products.
2. Browse a category or search for "sword."
3. Filter by price range / material, sort by price.
4. Open a product detail page, view gallery, pick a variant (e.g. size), add to cart.
5. Continue shopping or open cart drawer, adjust quantity.
6. Proceed to checkout as guest (email + shipping address, no account required).
7. Pay via Stripe Checkout (test mode).
8. Land on order confirmation page; receive confirmation email.
9. Optionally create an account post-purchase to save the order to history.

### 3.2 Returning customer
1. Sign in.
2. View order history, reorder or track status.
3. Manage saved addresses.
4. Manage wishlist, move wishlist item to cart.

### 3.3 Guest cart → account merge
1. Guest adds items to cart (server-side cart keyed by a signed cookie token).
2. Guest signs up or logs in mid-session.
3. Cart contents merge into the user's persistent cart (quantities summed, capped at stock).

### 3.4 Admin catalog management
1. Sign in with an admin-role account.
2. Create/edit a category, then a product with variants, images, and stock.
3. Publish a promotional banner scheduled for a date range.
4. Review low-stock alerts on the analytics dashboard.

### 3.5 Admin order fulfillment
1. Order arrives via webhook-confirmed payment (status: `paid`).
2. Admin marks it `fulfilled` once shipped (simulated — no real carrier).
3. Admin can issue a refund, which updates order + payment status and logs an audit entry.

## 4. Sitemap / Information Architecture

```
/                              Landing page
/catalog                       All products (filter/sort/search)
/catalog/[category]            Category listing
/product/[slug]                Product detail
/search?q=                     Search results
/wishlist                      Wishlist (auth required)
/cart                          Cart page (also available as a drawer)
/checkout                      Checkout (guest or auth)
/order/confirmation/[id]       Order confirmation
/account                       Account overview
/account/orders                Order history
/account/orders/[id]           Order detail
/account/addresses             Address book
/account/settings              Profile/password
/sign-in
/sign-up
/privacy                       Legal placeholder: Privacy Policy
/terms                         Legal placeholder: Terms of Service
/shipping-returns              Legal placeholder: Shipping & Returns
/admin                         Admin dashboard home (analytics)
/admin/products                Product CRUD
/admin/products/[id]
/admin/categories              Category CRUD
/admin/orders                  Order management
/admin/orders/[id]
/admin/banners                 Promotion/banner CRUD
/admin/audit-log               Audit log viewer
/admin/users                   User role management
/api/webhooks/stripe           Payment webhook (server-only)
```

## 5. Core Features

1. **Landing page** — hero banner rotation, featured categories, featured/new products, promo sections.
2. **Catalog** — paginated grid, category navigation, filters (category, price range, material, in-stock), sort (price, newest, featured), Postgres full-text search with fuzzy matching.
3. **Product detail** — image gallery, description, variant selector (e.g. size/material), live stock indicator, related products (same category).
4. **Wishlist** — authenticated users can save/remove products; visible on product card and detail page.
5. **Cart** — guest (cookie-token) and authenticated (DB-backed) carts, quantity update, removal, stock-aware clamping, persists across sessions, merges guest → user on login.
6. **Checkout** — address form, flat-rate shipping method selection, order summary, Stripe Checkout redirect, idempotent order creation.
7. **Order confirmation & history** — pending/paid/failed states reflected in UI, authenticated order history, guest order lookup via emailed link (order id + email).
8. **Auth** — email/password + GitHub OAuth via Better Auth, role-based access (customer/admin), session management.
9. **Account area** — profile, address book, order history.
10. **Admin dashboard** — product CRUD (with images, variants, stock), category CRUD (nested), order management (status transitions, refunds), banner/promotion CRUD with scheduling, analytics (revenue, top products, low stock, recent orders), audit log viewer, user role management.
11. **Payments** — abstracted `PaymentProvider` interface; Stripe (test mode) as the real provider, an in-repo Mock provider for offline demos/tests; webhook-confirmed status only, never a client-trusted success.
12. **Email notifications** — order confirmation, welcome/verification, password reset — via a swappable `EmailProvider` (Resend in prod-like envs, console/log provider in local dev).
13. **Inventory tracking** — per-variant stock, decremented transactionally on paid orders, all changes recorded in an inventory log.
14. **Promotional content** — admin-managed banners with placement (hero/category) and active date range.
15. **Analytics/telemetry** — first-party event capture (page view, add-to-cart, checkout started, purchase) feeding the admin analytics dashboard.
16. **Dark mode**, responsive layout, accessible UI primitives.

## 6. Non-Goals (explicitly out of scope)

- Real payment processing, real money movement, or PCI-scoped card handling.
- Multi-vendor marketplace features (single merchant only).
- Multi-currency conversion (single currency, USD, at launch — currency is modeled but not converted).
- Multi-language/i18n UI (English only; content structure allows future i18n, not implemented).
- Real shipping-carrier integration or live rate quoting (flat-rate/simulated options only).
- Product reviews/ratings, Q&A, or user-generated content.
- Coupons/discount codes and gift cards (explicitly deferred — noted as a clean extension point, not built).
- Subscriptions or recurring billing.
- Native mobile apps.
- Enterprise-scale GDPR/CCPA compliance tooling (basic privacy hygiene only: no unnecessary PII collection, clear data model boundaries).
- High-availability / multi-region infrastructure.

## 7. Edge Cases to Handle Explicitly

- Item goes out of stock between "add to cart" and checkout → block checkout, surface per-line error, let user adjust quantity or remove.
- Concurrent purchases racing on the last unit of stock → stock decrement happens inside a DB transaction with a row-level check; the losing request fails cleanly, order is not created/paid twice.
- Price changes between add-to-cart and checkout → cart line stores a price snapshot at add-time; checkout re-validates against current price and flags changes before payment.
- Duplicate Stripe webhook delivery → events are de-duplicated by Stripe event id in a processed-events table; handler is idempotent.
- Stripe Checkout Session expires or user abandons payment → order remains `pending`, a scheduled/admin-visible state, not silently lost; user can retry from the confirmation/cart page.
- Guest checkout with an email that already has an account → order is linked to the existing account by email match at fulfillment time is *not* automatic (avoids account-takeover-by-email); instead the guest is prompted to sign in for a linked history, otherwise the order is retrievable via the emailed guest lookup link.
- Cart merge on login when both guest and user carts contain the same product → quantities sum, clamped to available stock.
- Admin deletes a category that still has products → soft-delete only; products are reassigned to "Uncategorized" or the delete is blocked until reassignment (decision: block with a clear error, since silent reassignment hides data).
- Admin uploads an invalid/oversized image → validated client- and server-side (type, size, dimensions), clear error state, no partial product save.
- Session expires mid-checkout → user is redirected to sign-in with cart/checkout state preserved server-side (cart is server-backed, not client memory).
- Refund issued on an already-refunded or unpaid order → blocked with a clear error; refund action only valid from `paid`/`fulfilled` states.

## 8. Success Criteria

- A visitor can go from landing page to a confirmed order using only the mock payment provider, with zero manual steps, in under 2 minutes.
- All state-changing admin actions produce an audit log entry with actor, action, entity, and timestamp.
- Stock never goes negative under concurrent load (verified by a test that fires parallel checkouts against a single-unit-stock product).
- Lighthouse scores (mobile, production build) ≥ 90 for Performance, Accessibility, Best Practices, SEO on `/`, `/catalog`, `/product/[slug]`.
- Automated test suite covers: cart math, checkout/webhook idempotency, stock decrement concurrency, auth flows, and the full purchase journey end-to-end.
- The project deploys from a clean checkout with documented commands (`docs/plan.md` + `CLAUDE.md`) and no undocumented manual steps.

## 9. Accessibility Requirements

- Target **WCAG 2.2 AA**.
- Full keyboard operability: nav menus, filters, cart drawer, modals/dialogs, variant selectors — all reachable and operable without a mouse, with visible focus states.
- Semantic HTML first (`nav`, `main`, `button`, `label`+`input`), ARIA only to fill gaps (e.g. live region announcing cart updates, combobox roles for the search-with-suggestions input).
- Every product image requires alt text (enforced at the admin form level; falls back to product name if omitted, never left empty).
- Color contrast ≥ 4.5:1 for body text in both light and dark themes (validated against the chosen palette, not assumed).
- Skip-to-content link on every page.
- Form errors are associated with their fields (`aria-describedby`) and announced via `aria-live` on submit failure.
- Automated `axe-core` scans in CI on key pages as a regression guard (not a substitute for manual keyboard/screen-reader spot checks before major releases).

## 10. SEO Requirements

- Server-rendered/statically-generated product, category, and landing pages (Next.js App Router, ISR with on-demand revalidation on admin publish/edit).
- Per-page `generateMetadata` (title, description, canonical URL, Open Graph + Twitter card images).
- Structured data: `Product`, `BreadcrumbList`, and `Organization` JSON-LD on relevant pages.
- Generated `sitemap.xml` (products + categories) and `robots.txt`.
- Clean, human-readable slugs for products and categories; slugs are immutable-by-default after first publish to avoid link rot (changing one requires an explicit admin confirmation and does not auto-redirect in v1 — noted as a known limitation).
- Descriptive heading hierarchy (`h1` per page, no skipped levels).

## 11. Performance Targets

- Core Web Vitals on production build, mobile throttled profile: **LCP < 2.5s, INP < 200ms, CLS < 0.1** on `/`, `/catalog`, `/product/[slug]`.
- Product/category pages use ISR so the common path is served from cache, not computed per request.
- Images served via `next/image` with responsive `sizes`, modern formats (AVIF/WebP), and explicit width/height to avoid layout shift.
- Route-level code splitting by default (App Router); avoid client components for anything that doesn't need interactivity.
- Database queries for catalog listing are covered by indexes (category, price, full-text search GIN index); no N+1 query patterns in listing/detail endpoints (verified by query-count assertions in tests, not just eyeballing).

## 12. Security Considerations

- All external input validated server-side with Zod at every API/server-action boundary — client-side validation is UX only, never trusted.
- Parameterized queries exclusively via Drizzle's query builder; no raw string-interpolated SQL.
- Passwords hashed by Better Auth's built-in scrypt; sessions in httpOnly, secure, sameSite cookies.
- Stripe webhook signature verified against the raw request body before any event is processed; unknown event types are logged and ignored, never crash the handler.
- Admin routes protected by both middleware (fast-path redirect) and server-side role checks inside each server action/route (defense in depth — never trust middleware alone).
- Rate limiting (Upstash Redis token bucket) on auth endpoints (sign-in, sign-up) and checkout/webhook endpoints to blunt credential-stuffing and abuse.
- Secrets only via environment variables, validated at boot by a typed env schema; nothing secret is ever committed (`.env.example` documents required keys with placeholder values).
- No card data ever touches the app server — Stripe Checkout is hosted, PCI scope stays with Stripe.
- Every admin mutation (product/category/order/banner/user-role change) writes an audit log row: actor id, action, entity type/id, before/after summary, timestamp.
- Security headers (CSP, X-Frame-Options, Referrer-Policy) set at the framework level.
- Dependency vulnerability scanning via GitHub Dependabot on the CI pipeline.

## 13. Analytics / Telemetry Needs

- First-party `AnalyticsEvent` capture for: `page_view`, `add_to_cart`, `wishlist_add`, `checkout_started`, `checkout_completed`, `search_performed` — stored with a session id, optional user id, path, and JSON metadata.
- Admin analytics dashboard aggregates: revenue over time, order count, average order value, top products by revenue/units, low-stock alerts (variant stock below a configurable threshold), and a simple funnel (page view → add to cart → checkout started → completed) derived from the events above.
- No third-party analytics is a hard dependency; the architecture leaves a clean slot to add PostHog or similar later for richer session/funnel analysis (see [architecture.md](architecture.md)).
- All analytics data is first-party and anonymous-by-default for guests (session-scoped id, no cross-site tracking, no ad pixels — consistent with the "basic privacy hygiene" non-goal boundary above).

## 14. Open Assumptions

These are stated explicitly per the process rules — flag if any should change:

1. Single currency (USD), single locale (en-US), single shipping region for v1.
2. Guest checkout is supported (not gated behind account creation) — this is standard for modern e-commerce conversion and was implied by "checkout flow" + "order confirmation" being listed ahead of any account-gating requirement.
3. "Analytics dashboard" is interpreted as an **admin-facing sales/behavior dashboard**, not a public web-analytics product — matches the admin feature list in the request.
4. Coupons/discounts were not explicitly requested and are treated as a non-goal to keep scope credible rather than sprawling; the data model and checkout flow are structured so adding a `Discount` entity later doesn't require rearchitecting.
5. Product variants (e.g., armor sizes, cloak colors) are included as a lightweight optional layer per product, since believable fantasy gear (armor, cloaks) realistically needs them and it demonstrates deeper e-commerce data modeling than flat SKUs.
6. Deployment target defaults to Vercel + managed Postgres (Neon) for the live portfolio demo, with a full Docker Compose stack for local dev and as a self-hosted alternative — both are first-class, not just one afterthought (see [ADR 0001](adr/0001-stack-choice.md)).
