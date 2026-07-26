# Medivi Shop — Architecture

Status: Draft v1.0
Last updated: 2026-07-25

Companion docs: [spec.md](spec.md) (what/why) · [plan.md](plan.md) (stack/how) ·
[ADR 0001](adr/0001-stack-choice.md) (why this stack) · [tasks.md](tasks.md) (build order)

## 1. Repository Layout

A single deployable app (`apps/web`) with the domain logic split into
packages. This is a monorepo *in service of* clean boundaries — not a
multi-service system. Only `apps/web` is deployed; packages are internal.

```
medivi-shop/
├── apps/
│   └── web/                 # Next.js 16 App Router — storefront + admin + API
│       ├── app/              # routes (public, account, admin, api)
│       ├── components/       # app-specific composed components
│       ├── lib/               # server actions, data access wiring, auth config
│       └── proxy.ts       # Next.js 16 renamed middleware.ts → proxy.ts
├── packages/
│   ├── db/                  # Drizzle schema, migrations, seed script, query helpers
│   ├── ui/                  # shadcn/ui-based primitives shared by app
│   ├── payments/             # PaymentProvider interface + Stripe + Mock implementations
│   ├── email/                 # EmailProvider interface + Resend + Console implementations + React Email templates
│   ├── storage/                # StorageProvider interface + S3 (MinIO) + Vercel Blob implementations
│   └── config/                # shared tsconfig, eslint, tailwind preset
├── docker/
│   ├── docker-compose.yml    # Postgres + Redis + MinIO for local dev
│   └── docker-compose.prod.yml
├── .github/workflows/ci.yml
├── docs/
├── turbo.json
├── pnpm-workspace.yaml
└── CLAUDE.md
```

**Why split packages instead of one flat Next.js app:** the payment and email
abstractions are the two places a "plug in a real provider later" requirement
is explicit — isolating them in packages with a narrow interface makes that
swap mechanical instead of a grep-and-pray refactor. `db` as its own package
keeps schema/migrations reviewable independent of app code. `ui` separates
"generic primitive" from "Medivi-specific composition," which is the natural
seam if this ever grew a second surface (e.g., a separate marketing site).

## 2. Request-Time Architecture

Next.js App Router, deployed as a single Node.js server (Vercel or Docker):

- **React Server Components** for all data-reading pages (catalog, product,
  account, admin lists) — direct DB access via `packages/db`, no internal
  fetch-your-own-API round trip.
- **Server Actions** for all mutations (add to cart, checkout, admin CRUD) —
  co-located with the components that call them, validated with Zod at the
  boundary.
- **Route Handlers** (`app/api/...`) reserved for things that aren't
  React-invoked: the Stripe webhook, and the sitemap/robots generation.
- **Client Components** only where interactivity requires it (cart drawer,
  filter panel, image gallery, admin forms with client-side validation
  feedback) — kept as thin as possible, with Zustand for local UI state and
  no client-side data-fetching layer needed for most flows since Server
  Components handle reads.

This avoids a redundant "frontend calls its own backend API" layer that adds
no value in a single-deployable-app architecture, while the `packages/*`
boundaries still keep the codebase honest about where business logic lives.

## 3. Domain Data Model

```
User ──< Address
User ──< Wishlist ──< WishlistItem >── Product
User ──< Cart (nullable userId; guest carts keyed by signed cookie token)
Cart ──< CartItem >── Product / ProductVariant

Category ──< Category (self-referencing, nullable parentId)
Category ──< Product ──< ProductImage
Product ──< ProductVariant
Product/ProductVariant ──< InventoryLog

User ──< Order ──< OrderItem >── Product / ProductVariant (price/name snapshot)
Order ── Payment (1:1 today, modeled 1:many for future partial-capture/refund history)
Payment ──< ProcessedWebhookEvent (idempotency ledger)

Banner (standalone; placement + active window)
FeatureFlag (standalone; key/boolean/admin-toggle)
AuditLog (actorId, action, entityType, entityId, diff JSON, createdAt)
AnalyticsEvent (sessionId, userId?, type, path, metadata JSON, createdAt)
```

Key modeling decisions:

- **Snapshotting on Order/OrderItem.** Order items store `name`, `unitPrice`,
  and `variantLabel` at time of purchase — never joined live from `Product`.
  Historical orders must stay accurate even if a product is later renamed,
  repriced, or deleted.
- **Stock lives on the variant when variants exist, else on the product.**
  Every product has at least an implicit "default" variant row so stock logic
  never branches on "does this product have variants."
- **`ProcessedWebhookEvent`** is a small table keyed by Stripe's `event.id`,
  written inside the same transaction as the order/payment update. This is
  the idempotency mechanism — a redelivered webhook is a no-op, not a
  double-fulfilled order.
- **`AuditLog`** is append-only, never edited or deleted by the app.

Full column-level schema is defined in `packages/db/schema/*.ts` (Drizzle) and
generated as part of Task Phase 1 — this doc intentionally stays at the
entity-relationship level so it doesn't drift from the actual migrations.

## 4. Critical Flow: Cart → Checkout → Payment Confirmation

```
1. Add to cart (Server Action)
   → validate product/variant + requested qty ≤ available stock
   → upsert CartItem, snapshot current price
   → guest: cart id lives in a signed httpOnly cookie; user: cart.userId

2. Checkout (Server Action: createOrder)
   → re-validate every line: current stock, current price vs. cart snapshot
     (flag price drift to the user before proceeding)
   → create Order (status=pending) + OrderItems inside one transaction
   → call PaymentProvider.createCheckoutSession(order) → redirect to Stripe

3. Stripe-hosted checkout (external, test mode)

4. Webhook: POST /api/webhooks/stripe
   → verify signature against raw body (reject if invalid, log + 400)
   → look up event.id in ProcessedWebhookEvent — if present, return 200 no-op
   → in one transaction:
       - insert ProcessedWebhookEvent
       - update Payment.status, Order.status → paid
       - decrement variant stock (guarded: fails the transaction if stock
         would go negative — this is the concurrency backstop, not just the
         add-to-cart check)
       - write InventoryLog rows
   → outside the transaction (best-effort, retried async if it fails):
       - send order confirmation email via EmailProvider

5. Order confirmation page (/order/confirmation/[id])
   → reads Order.status; shows pending/paid/failed accordingly
   → client polls or revalidates briefly if still pending (webhook can lag
     the redirect)
```

This is the flow the spec's concurrency and idempotency edge cases map to
directly — see [spec.md §7](spec.md#7-edge-cases-to-handle-explicitly).

## 5. Payment Abstraction

```ts
interface PaymentProvider {
  createCheckoutSession(input: CreateCheckoutInput): Promise<{ url: string; providerSessionId: string }>
  verifyAndParseWebhook(rawBody: string, signature: string): PaymentEvent // throws on bad signature
  refund(providerPaymentRef: string, amount?: number): Promise<RefundResult>
}
```

- `StripeProvider` — real implementation, Stripe test-mode keys, Checkout
  Sessions API, `checkout.session.completed` as the fulfillment trigger.
- `MockProvider` — no network calls; `createCheckoutSession` returns an
  internal `/checkout/mock/[token]` URL with an "approve/decline" UI, used for
  local dev without Stripe keys and for Playwright E2E/CI so tests don't
  depend on a live Stripe sandbox.
- Selected via `PAYMENT_PROVIDER=stripe|mock` env var; the rest of the app
  (order creation, webhook handler shape, order status machine) is identical
  regardless of provider — this is the "plug in a real provider later"
  requirement satisfied structurally, not by convention.

Order/Payment status is **never** set to `paid` from the redirect/return URL —
only the webhook path (or the Mock provider's equivalent server-side
callback) can do that. This is stated as a hard rule in [CLAUDE.md](../CLAUDE.md)
because it's the single most common shortcut that quietly breaks payment
correctness.

## 6. Email Abstraction

Same shape as payments: `EmailProvider.send(template, to, data)`, with
`ResendProvider` (real) and `ConsoleProvider` (logs the rendered email in
dev/test instead of sending). Templates are React Email components in
`packages/email/templates`, rendered to HTML server-side before handoff to
the provider — the provider never sees template logic, only a rendered
payload.

## 7. Search & Filtering

Postgres-native: a generated `tsvector` column on `Product` (name +
description, weighted) with a GIN index, plus `pg_trgm` for typo-tolerant
fallback matching. Filters (category, price range, material, in-stock) and
sort (price, newest, featured) are plain indexed `WHERE`/`ORDER BY` clauses
via Drizzle, combined with the search query when present. No external search
service is required to run the project. If a future iteration wants
instant/as-you-type search relevance beyond FTS, a self-hosted Meilisearch
container is the documented upgrade path (not built now — see
[spec.md §6 Non-Goals](spec.md#6-non-goals-explicitly-out-of-scope) for scope
boundary reasoning).

## 8. Caching

- **ISR** (time + on-demand revalidation) for catalog/category/product pages;
  admin publish/edit actions call `revalidatePath`/`revalidateTag` so changes
  go live without waiting on a timer.
- **Upstash Redis** for: rate-limit counters (auth, checkout, webhook
  endpoints) and short-lived read-through caches for hot aggregate queries
  (e.g., homepage featured products) where recomputing per-request is wasted
  work. Redis is a performance/protection layer, never a system of record.

## 9. Observability & Error Handling

- Structured JSON logs (pino) from every server action/route handler:
  request id, actor id (if any), action, outcome, duration.
- Sentry captures unhandled exceptions client + server side, with release
  tagging tied to deploy commit.
- Error handling philosophy: validate at the boundary (Zod) and let
  unexpected errors throw — Next.js `error.tsx` boundaries render a
  friendly page per route segment (catalog, checkout, admin) rather than one
  global catch-all, so a failure in the admin panel never takes down the
  storefront's error UI and vice versa.
- The webhook handler is the one place errors are handled defensively rather
  than left to throw: malformed/unverifiable payloads are logged and
  rejected (4xx) instead of crashing, because Stripe controls the retry
  behavior on the other end.

## 10. Deployment Topology

Two supported targets, both documented and both exercised (not just one
"real" path and one aspirational one):

**A. Vercel (primary, for the live portfolio demo)**
- `apps/web` deployed via Vercel's git integration (preview per PR, prod on
  merge to `main`).
- Neon (serverless Postgres), Upstash (Redis), Vercel Blob (product images),
  Resend (email).

**B. Docker Compose (self-host / local dev)**
- `docker-compose.yml`: Postgres, Redis, MinIO (S3-compatible storage), and
  the app itself built from a multistage `Dockerfile`.
- Same codebase, only env vars differ (`STORAGE_PROVIDER=s3` vs
  `STORAGE_PROVIDER=vercel-blob`, `PAYMENT_PROVIDER=mock` for a fully offline
  demo).

Storage and payments are both behind provider interfaces for exactly this
reason: the two deployment targets should never require a code branch, only
a config branch.

## 11. Module/Access Boundaries

- `apps/web` may import from any `packages/*`.
- `packages/*` never import from `apps/web` or from each other except
  `payments`/`email` may depend on `db` for logging/idempotency tables only —
  not on app-level types.
- Admin-only server actions live under `app/admin/**` and each one
  independently re-checks the caller's role server-side (never trusts a
  layout-level guard alone) — see [spec.md §12 Security](spec.md#12-security-considerations).
