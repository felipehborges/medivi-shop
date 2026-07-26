# Medivi Shop — Technical Plan

Status: Draft v1.0
Last updated: 2026-07-25

This document is the "how" layer: concrete stack, versions, and per-domain
technical approach. Rationale for the contested choices lives in
[ADR 0001](adr/0001-stack-choice.md); system design and data flow live in
[architecture.md](architecture.md).

## 1. Stack Summary

Versions below were verified via web search on 2026-07-25 (not assumed from
training data), per the project's "verify before implementing" rule. Exact
patch versions will be re-pinned at `package.json` creation time in Task
Phase 0, since they drift weekly.

| Concern | Choice | Version (verified 2026-07-25) |
|---|---|---|
| Runtime | Node.js | 24.x (current active LTS line; 26 becomes LTS Oct 2026) |
| Package manager / monorepo | pnpm + Turborepo | latest stable |
| Language | TypeScript | 5.9.x, `strict: true`¹ |
| Framework | Next.js (App Router, Turbopack) | 16.2.x |
| UI runtime | React | 19.2 |
| Styling | Tailwind CSS | v4 |
| UI primitives | shadcn/ui (Radix style) | latest |
| Client state | Zustand | latest |
| Forms/validation | React Hook Form + Zod | latest |
| Database | PostgreSQL | 16/17 (Neon prod, Docker local) |
| ORM | Drizzle ORM + drizzle-kit | latest |
| Auth | Better Auth (+ Drizzle adapter) | 1.6.x |
| Payments | Stripe (Checkout Sessions + Webhooks) | API version pinned to latest dated release at implementation time |
| Email | Resend + React Email | latest |
| Cache / rate limit | Upstash Redis | latest |
| Object storage | Vercel Blob (prod) / MinIO (local, S3-compatible) | latest |
| Error tracking | Sentry | latest |
| Logging | pino | latest |
| Unit/integration tests | Vitest + Testing Library | latest |
| E2E tests | Playwright | latest |
| Accessibility checks | axe-playwright | latest |
| CI | GitHub Actions | n/a |
| Deployment | Vercel (primary) + Docker Compose (self-host) | n/a |

Exact versions get locked into `package.json`/`pnpm-lock.yaml` in the first
implementation task, not hand-typed here — this table is a decision record,
the lockfile is the source of truth going forward.

¹ TypeScript 7.0 (the native Go-port compiler) reached GA on 2026-07-08 and is
now the `latest` npm tag, but `typescript-eslint` — which `eslint-config-next`
depends on — doesn't get a stable programmatic API to target it until 7.1.
Pinning to 5.9.x avoids a broken lint pipeline on day one; revisit once 7.1
ships and the ecosystem (Next.js tooling, typescript-eslint) confirms support.

## 2. Frontend

- Next.js App Router; Server Components by default, Client Components only
  for stateful interactivity (cart drawer, filters, galleries, admin forms).
- Route groups: `(storefront)`, `(account)`, `(admin)`, plus `api/` for
  webhooks and generated `sitemap.xml`/`robots.txt`.
- Design system: shadcn/ui primitives in `packages/ui`, themed via Tailwind
  v4 `@theme` tokens for a medieval/fantasy palette (parchment, iron, wax-seal
  red, aged gold) with a dark "torch-lit" mode — both validated for 4.5:1
  text contrast before adoption, not just eyeballed.
- Typography: a serif display face for headings (fantasy/editorial feel), a
  legible sans for body text — never sacrifice legibility for theme.

## 3. Backend

- No separate API service. Server Actions handle mutations; Route Handlers
  handle non-React callers only (Stripe webhook, sitemap/robots, health
  check).
- All server-side entry points (actions + route handlers) validate input
  with Zod before touching the database.
- Business logic (stock checks, order totals, cart merge rules) lives in
  plain TypeScript functions in `packages/db`/`apps/web/lib`, unit-testable
  without booting Next.js.

## 4. Database

- PostgreSQL, schema-owned by `packages/db` (Drizzle). One migration per
  logical change, checked into version control, applied via `drizzle-kit
  migrate` in CI before deploy.
- Seed script populates realistic fantasy inventory (categories: Swords,
  Shields, Armor, Cloaks, Relics, Potions, Banners; ~30-40 products with a
  mix of simple and variant products) plus a default admin account for local
  dev — clearly marked test credentials, never usable in a real deployment
  since Better Auth accounts are created per-environment.

## 5. Auth

- Better Auth, email/password + GitHub OAuth, Drizzle adapter, session
  cookie (httpOnly/secure/sameSite).
- `User.role` (`customer` | `admin`); no self-service admin signup — admin
  role is granted via seed data or an existing admin promoting a user in
  `/admin/users`.
- `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`, still runs as
  the same conceptual middleware layer) redirects unauthenticated requests
  away from `/account/**` and `/admin/**` as a fast path, checking only for
  a session cookie's presence — it cannot see role, so admin authorization
  is enforced separately; every admin server action re-checks role
  server-side regardless (defense in depth, see
  [architecture.md §11](architecture.md#11-moduleaccess-boundaries)).

## 6. Cart

- Server-backed, not client-state: `Cart`/`CartItem` rows are the source of
  truth. Guest carts are addressed by a signed, httpOnly cookie token (not a
  guessable id); authenticated carts key off `userId`.
- On login, guest cart items merge into the user's cart (sum quantities,
  clamp to current stock), then the guest cart row is deleted.
- Add/update/remove are Server Actions; the cart drawer is a thin Client
  Component reflecting server state via Next.js's mutation + revalidation
  cycle, not a separately-synced client store.
- "Signed" cookie token, concretely: the cookie value is
  `${guestToken}.${hmacHex}` where `hmacHex = HMAC-SHA256(guestToken,
  BETTER_AUTH_SECRET)`, verified with a timing-safe comparison on read — no
  new secret/dependency, reuses the Better Auth secret already required.
  `guestToken` itself is the random id stored in `cart.guest_token`. A
  missing/invalid/tampered signature is treated the same as no cookie at
  all (a fresh guest cart is created transparently on the next
  add-to-cart) — this is a low-value target (an empty or someone else's
  guest cart), so failing open to "start over" is simpler than surfacing
  an error, unlike auth/payment tokens where failing open would be a real
  vulnerability.

## 7. Checkout

- Single-page checkout: shipping address (reuses saved address if
  authenticated) + flat-rate shipping method + order summary.
- `createOrder` Server Action re-validates stock and price against current
  DB state (not the cart's cached snapshot) before creating the order, and
  surfaces a diff to the user if price/stock changed since they added the
  item.
- Order is created `pending` *before* redirecting to Stripe, so a
  never-returned browser session still leaves a traceable, admin-visible
  record instead of silently vanishing.

## 8. Payment Abstraction

See [architecture.md §5](architecture.md#5-payment-abstraction) for the
interface. Implementation notes:
- `StripeProvider`: Checkout Sessions API, `metadata.orderId` links the
  Stripe session back to the internal order; webhook handler is the only
  writer of `Payment.status`/`Order.status` transitions to `paid`/`failed`.
- `MockProvider`: renders an internal approve/decline page, calls the same
  webhook-shaped internal handler so the fulfillment code path is identical
  in tests and demos as it is with real Stripe.
- Provider selected by `PAYMENT_PROVIDER` env var; never inferred from
  `NODE_ENV` (so `mock` can be used in a "real" deployment for demo purposes
  without a code change, and `stripe` test-mode can be exercised locally).

## 9. Order Management

- Order status machine: `pending → paid → fulfilled`, with `paid → refunded`
  and `pending → cancelled` (expired/abandoned) as the other valid
  transitions. Invalid transitions (e.g. refunding a `pending` order) are
  rejected at the server-action layer with a typed error, not just a UI
  disabled-button (server is the enforcement point).
- Admin order detail supports manual `paid → fulfilled` (simulating
  shipment) and refund (calls `PaymentProvider.refund`, then updates status).

## 10. Product Catalog

- `Product` belongs to one `Category`; `Category` supports one level of
  nesting (parent/child) — enough to model "Armor > Helmets" without
  building a full arbitrary-depth tree UI.
- Listing query supports: category filter, price range, material filter,
  in-stock-only toggle, sort (price asc/desc, newest, featured flag), and
  full-text search — all combinable, all reflected in the URL as search
  params so listings are shareable/bookmarkable and back-button-safe.

## 11. Search / Filtering

- Postgres `tsvector` (generated column, GIN index) over product name +
  description, `pg_trgm` for fuzzy fallback when FTS returns nothing.
- Search bar debounced client-side, results rendered server-side
  (progressive enhancement — works with JS disabled via a plain form GET,
  enhanced with instant feedback when JS is available).

## 12. Admin Dashboard

- `/admin/**`, guarded by role. Sections: Products, Categories, Orders,
  Banners, Analytics, Audit Log, Users.
- Product/category forms use React Hook Form + Zod resolver, shared schema
  with the server action (single schema, imported both places — no drift
  between client and server validation).
- Analytics dashboard reads aggregate SQL views/queries (revenue over time,
  top products, low stock, recent orders) — no separate analytics service
  required for v1 (see [spec.md §13](spec.md#13-analytics--telemetry-needs)).

## 13. Images / Media

- Admin image upload → validated (type/size/dimensions) → stored via a
  `StorageProvider` interface (`VercelBlobProvider` / `S3Provider` for
  MinIO) → URL saved on `ProductImage`.
- `next/image` everywhere on the frontend for responsive, lazy-loaded,
  layout-shift-safe images.
- Seed data uses generated/placeholder imagery only (no real product
  photography, per the fictional-store requirement).

## 14. Caching

- ISR for catalog/category/product pages; `revalidateTag`/`revalidatePath`
  triggered from admin mutations so publishes are immediate.
- Upstash Redis for rate-limit counters and short-TTL read caches on hot
  aggregate reads (e.g. homepage featured products). Never the system of
  record for cart/order/payment state.

## 15. Email

- `EmailProvider` interface (`send(template, to, data)`); `ResendProvider`
  in real environments, `ConsoleEmailProvider` (logs rendered output) in
  local dev/CI so email sending is exercised without external calls.
- Templates: order confirmation, welcome/verify-email, password reset — React
  Email components in `packages/email`, rendered to HTML before handoff to
  the provider.

## 16. Testing

- **Unit (Vitest):** cart math, price/stock re-validation, order status
  machine transitions, webhook idempotency logic, Zod schemas.
- **Component (Testing Library):** cart drawer, filter panel, variant
  selector, admin forms.
- **E2E (Playwright, `PAYMENT_PROVIDER=mock`):** full purchase journey,
  auth journey (sign up/in/out, guest→account cart merge), admin CRUD
  journey, wishlist add/remove.
- **Concurrency test:** parallel checkout requests against a single-unit-
  stock product must yield exactly one `paid` order and one rejection —
  this directly verifies the [spec.md success criterion](spec.md#8-success-criteria)
  on stock never going negative.
- **Accessibility (axe-playwright):** automated scan on landing, catalog,
  product detail, cart, checkout, admin product list as a CI regression
  gate.

## 17. Deployment

- **Primary:** Vercel git integration — preview deployment per PR, promote
  to production on merge to `main`. Neon (Postgres), Upstash (Redis), Vercel
  Blob (images), Resend (email).
- **Self-host:** multistage `Dockerfile` for `apps/web` + `docker-compose.yml`
  (Postgres, Redis, MinIO) — same image, different env vars.
- Database migrations run as an explicit CI/CD step (`drizzle-kit migrate`)
  gated *before* the new app version receives traffic, never on app boot
  (avoids concurrent-instance migration races).

## 18. CI/CD

GitHub Actions, on every PR: install (pnpm, cached) → lint → typecheck
(`tsc --noEmit`) → unit/component tests (Vitest) → build. On merge to `main`:
the above, plus Playwright E2E against an ephemeral Postgres + mock payment
provider, then Vercel's git integration deploys. Dependabot enabled for
dependency vulnerability alerts.

## 19. Observability

- Sentry (client + server) for exceptions, release-tagged to deploy commit.
- Structured JSON logs (pino) from every server action/route handler.
- Health check route (`/api/health`) verifying DB connectivity, used by
  Docker Compose healthchecks in self-host mode.

## 20. Error Handling

- Zod validation at every boundary; validation failures are typed, expected
  results (not thrown exceptions) so forms can render field-level errors.
- Unexpected errors throw and are caught by per-route-segment `error.tsx`
  boundaries (storefront, account, admin each get their own), so a failure
  in one surface doesn't blank the others.
- The Stripe webhook handler is the deliberate exception to "let it throw" —
  it validates defensively and returns clean 4xx/2xx because Stripe's retry
  behavior depends on the response.

## 21. Feature Flags

- A simple `FeatureFlag` table (`key`, `enabled`, `description`) with an
  admin toggle UI — used for things like "enable wishlist," "show holiday
  banner section." No third-party flag service for v1; documented as a
  clean place to introduce one (e.g. PostHog flags) if the project grows
  past single-instance admin toggles.

## 22. Environment Variables

- A single typed schema (Zod) validated at process boot (`apps/web/lib/env.ts`)
  — the app fails fast with a clear error listing missing/invalid vars
  rather than failing confusingly at first use.
- `.env.example` documents every variable with a placeholder and a one-line
  comment; real secrets are never committed. Key groups: `DATABASE_URL`,
  `BETTER_AUTH_SECRET`, OAuth client id/secret, `STRIPE_SECRET_KEY` /
  `STRIPE_WEBHOOK_SECRET` / `PAYMENT_PROVIDER`, `RESEND_API_KEY` /
  `EMAIL_PROVIDER`, `UPSTASH_REDIS_*`, `STORAGE_PROVIDER` + provider-specific
  storage credentials, `SENTRY_DSN`.

## 23. File Storage

- `StorageProvider` interface: `upload(file) -> url`, `delete(url)`.
  `VercelBlobProvider` in production, `S3Provider` pointed at MinIO locally —
  selected via `STORAGE_PROVIDER` env var, same pattern as payments/email.

## 24. State Management

- Server state (products, cart, orders) lives in Postgres and reaches the UI
  through Server Components + Server Action revalidation — no client-side
  cache duplicating server state for most flows.
- Zustand reserved for genuinely client-only, ephemeral UI state: cart
  drawer open/closed, filter panel expand/collapse, theme preference (synced
  to a cookie for SSR-correct dark mode on first paint).
