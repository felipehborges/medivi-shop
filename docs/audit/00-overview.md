# Medivi Shop — Deep Audit: Overview

Audit date: 2026-08-09
Scope: full repository at commit `ca4eac2` (branch `master`, clean tree)
Method: static reading of 100% of application source, schema, migrations,
tests, CI, Docker and docs. **No code was executed or modified.**

> This audit is a set of findings + an implementation plan. Nothing in the
> project was changed. Every file under `docs/audit/` is new.

---

## 1. How to read this audit

| File | Contents |
|---|---|
| `00-overview.md` | This file — system map, scoring, finding index |
| `01-architecture.md` | Layering, boundaries, doc-vs-code divergence |
| `02-frontend.md` | State, components, forms, UX, browser behaviour |
| `03-backend.md` | Server Actions, Route Handlers, validation, contracts |
| `04-ecommerce.md` | Product → cart → checkout → payment → order → post-order |
| `05-database.md` | Schema, constraints, indexes, transactions, migrations |
| `06-security.md` | AuthN/AuthZ, IDOR, injection, headers, secrets |
| `07-testing.md` | What is covered, what is not, what should exist |
| `08-performance.md` | Queries, caching, bundle, rendering |
| `09-edge-cases.md` | Failure-mode matrix per flow |
| `10-dependencies-and-config.md` | Packages, TS, lint, Docker, CI/CD, env |
| `11-improvement-plan.md` | **Every finding, consolidated and prioritised** |
| `12-execution-order.md` | **Ordered, dependency-aware task list for the next agent** |

Every finding has a stable ID (`SEC-01`, `ECM-03`, …). IDs are referenced
across files; `11-improvement-plan.md` is the single index of record.

### Confidence labels

Each finding carries one of:

- **Confirmed** — read directly in the code; the described behaviour follows
  from the source with no assumptions.
- **Likely** — strongly implied by the code but depends on runtime behaviour
  of a framework/library I could not execute here (noted per finding, with
  the exact check to run).
- **Question** — the code is unambiguous but the *intended* behaviour is not
  specified anywhere; needs a product decision.
- **Recommendation** — an improvement, not a defect.

---

## 2. What this project is

A fictional medieval/fantasy e-commerce store, built as a portfolio piece to
production standards. It is a **pnpm + Turborepo monorepo with exactly one
deployable** (`apps/web`, Next.js 16 App Router) and six internal packages.

```
medivi-shop/
├─ apps/web/                     Next.js 16 (App Router, React 19, Tailwind v4)
│  ├─ app/
│  │  ├─ (storefront)/           catalog, product, cart, checkout, order confirmation
│  │  ├─ (account)/              sign-in/up, forgot/reset password, account, wishlist
│  │  ├─ (admin)/admin/          products, categories, orders, banners, analytics,
│  │  │                          audit log, users
│  │  ├─ api/auth/[...all]/      Better Auth catch-all
│  │  ├─ api/webhooks/stripe/    payment webhook (the only writer of "paid")
│  │  ├─ api/analytics/track/    first-party analytics beacon sink
│  │  ├─ orders/lookup/          guest order lookup (outside every route group)
│  │  ├─ sitemap.ts, robots.ts
│  │  └─ layout.tsx              renders SiteHeader (session + cart) + SiteFooter
│  ├─ components/                app-specific composed components
│  ├─ lib/
│  │  ├─ actions/*.ts            all Server Actions ("use server")
│  │  ├─ schemas/*.ts            Zod schemas shared client↔server
│  │  ├─ auth.ts, auth-guards.ts Better Auth config + requireUser/requireAdmin
│  │  ├─ env.ts                  typed env (Zod), validated at import
│  │  ├─ cart-owner.ts, guest-cart-cookie.ts, cart.ts
│  │  ├─ payments.ts, email.ts, storage.ts, rate-limit.ts  (provider selectors)
│  │  └─ logger.ts, monitoring.ts, analytics-session.ts, shipping.ts, format.ts
│  ├─ proxy.ts                   Next 16's renamed middleware (cookie presence only)
│  └─ e2e/                       Playwright specs + seed fixture
└─ packages/
   ├─ db/         Drizzle schema (22 tables), 6 migrations, all query functions, seed
   ├─ ui/         shadcn/ui primitives + theme provider
   ├─ payments/   PaymentProvider interface + StripeProvider + MockProvider
   ├─ email/      EmailProvider interface + Resend/Console + React Email templates
   ├─ storage/    StorageProvider interface + S3(MinIO) + Vercel Blob
   ├─ ratelimit/  RateLimiter interface + Upstash + in-memory fallback
   └─ config/     shared tsconfig + eslint base
```

### Stack (verified from lockfile/manifests, not the docs)

Node 24 · pnpm 11.14 · Turborepo 2.10 · TypeScript 5.9 (`strict` +
`noUncheckedIndexedAccess`) · Next 16.2.11 · React 19.2 · Tailwind v4 ·
Drizzle ORM 0.45 + `postgres` 3.4 · PostgreSQL 17 · Better Auth 1.6.25 ·
Stripe 22.3 · Zod 4.4 · React Hook Form 7.83 · Vitest 4.1 · Playwright 1.62 ·
pino 10 · Sentry 10.

### Entrypoints

| Kind | Location | Auth |
|---|---|---|
| Pages (RSC) | `apps/web/app/**/page.tsx` | per-page `requireUser`/`requireAdmin` |
| Server Actions | `apps/web/lib/actions/*.ts` (12 files, ~35 actions) | per-action guard (**2 exceptions — see SEC-01**) |
| Route Handlers | `api/auth/[...all]`, `api/webhooks/stripe`, `api/analytics/track` | signature / none |
| Proxy (middleware) | `apps/web/proxy.ts` | cookie **presence** only, no role |
| Metadata routes | `app/sitemap.ts`, `app/robots.ts` | public |

### How the layers talk

There is **no internal HTTP API**. Server Components import query functions
from `@medivi/db/queries` and call Postgres directly; mutations go through
Server Actions imported by Client Components. That is a sound choice for a
single-deployable app and is implemented consistently.

The **only** cross-process boundaries are: the Stripe webhook, the analytics
beacon, Better Auth's own `/api/auth/*` routes, and the outbound provider
calls (Stripe / Resend / S3 / Upstash).

---

## 3. Overall assessment

This is a genuinely well-built project. Before the findings, what is right —
because the next agent needs to know what *not* to "fix":

- The provider-interface pattern (`PaymentProvider`, `EmailProvider`,
  `StorageProvider`, `RateLimiter`) is real, consistent, and correctly
  isolates vendors from app code.
- Order/cart line items genuinely snapshot price and name. No live re-join.
- The webhook fulfilment path is genuinely idempotent (`processed_webhook_event`
  keyed by provider event id, inserted in the same transaction).
- The guarded stock decrement (`UPDATE … WHERE stock >= quantity`) is the
  right concurrency primitive, and there is a real two-connection concurrency
  test proving it.
- Every admin mutation writes an audit-log row inside the same transaction as
  the mutation — verified per query module by tests.
- `requireAdmin()` is re-checked inside every admin Server Action *and* every
  admin page, not delegated to middleware. Verified: 12/12 admin pages, and
  all 20 admin actions.
- Zero raw string-interpolated SQL. Every `sql` template uses drizzle column
  references (parameterised).
- Guest-cart cookie is HMAC-signed and compared with `timingSafeEqual`.
- Ownership scoping is correct on addresses, wishlist, cart items and the
  authenticated order-detail page.

The defects concentrate in three places: **(a)** the mock-payment path, which
was built as a dev convenience and never fenced off from production; **(b)**
the *edges* of the fulfilment state machine (partial oversell, refund
ordering, expired sessions); and **(c)** a set of documented-but-unbuilt
cross-cutting features (ISR, security headers, health check, component and
a11y tests) that the docs assert as done.

### Scorecard

| Area | Grade | One-line summary |
|---|---|---|
| Architecture | B+ | Clean boundaries; docs describe caching that doesn't exist |
| Frontend | B | Solid RSC discipline; error handling in checkout is the weak point |
| Backend | B | Consistent validation & authorization, two real gaps |
| E-commerce logic | C+ | Happy path is excellent; the failure edges leak money/stock |
| Database | B− | Good constraints, thin indexing, timezone-naive timestamps |
| Security | C | Strong fundamentals undone by one P0 and a missing headers layer |
| Testing | B− | 200 real integration tests; zero component/a11y tests |
| Performance | C+ | No caching layer at all; a few seq-scan hot paths |
| DX / config | B | Excellent docs, one build-time-env trap in the Docker target |
| Documentation | A− | Unusually good, but now ahead of the code in ~6 places |

---

## 4. Finding index

**103 findings: 4 × P0 · 15 × P1 · 37 × P2 · 47 × P3.**
The authoritative, complete list is in
[`11-improvement-plan.md`](11-improvement-plan.md); below are the P0s and P1s.

### P0 — Critical

| ID | Title | Area |
|---|---|---|
| SEC-01 | Mock payment approval is an unauthenticated, always-live Server Action | Security / Payments |
| ECM-01 | `fulfillPaidOrder` commits a partial stock decrement on the oversold path | E-commerce |
| ECM-02 | `draft` / `archived` products can be added to cart and purchased | E-commerce |
| DB-06 | Payment/order status updates hit *every* payment row for an order | Database |

### P1 — High

| ID | Title | Area |
|---|---|---|
| SEC-02 | Open redirect (and probable `javascript:` sink) via mock-checkout redirect params | Security |
| SEC-03 | No security headers at all (CSP, X-Frame-Options, Referrer-Policy, HSTS) | Security |
| SEC-04 | Rate limiting keyed on a spoofable `X-Forwarded-For` | Security |
| ECM-03 | Refund calls the payment provider *before* validating order state | E-commerce |
| FE-01 | `checkoutAction` is called with no error handling | Frontend |
| ARCH-01 | ISR / on-demand revalidation is documented everywhere and implemented nowhere | Architecture |
| ARCH-06 | The mock provider's routes/actions are not gated by `PAYMENT_PROVIDER` | Architecture |
| PERF-01 | `revalidatePath("/", "layout")` on every cart mutation and every webhook | Performance |
| DB-01 | Missing indexes on every hot order/payment/analytics/audit access path | Database |
| CFG-01 | `NEXT_PUBLIC_APP_URL` is frozen to `http://localhost:3000` in the Docker image | Config |
| CFG-02 | Self-host image URLs point at the internal `minio:9000` host | Config / Storage |
| IMG-01 | An admin-entered image URL on a non-allowlisted host crashes the landing page | Frontend |
| TST-01 | Zero component tests; the promised Testing Library layer does not exist | Testing |
| TST-02 | `axe-core` is installed but never executed; no a11y gate in CI | Testing |
| TST-03 | Every P0 in this audit sits in a code path with no covering test | Testing |

### P2 (37) and P3 (47)

Listed in full in [`11-improvement-plan.md`](11-improvement-plan.md).

---

## 5. Cross-cutting themes

Four patterns explain most of the findings. Fixing the *pattern* is more
valuable than fixing each instance.

1. **"Dev-only" code that was never fenced.** The mock payment provider is
   selected by env var, but the *pages and Server Actions* that serve it are
   compiled and callable unconditionally. `PAYMENT_PROVIDER` gates the
   provider object, not the attack surface. → SEC-01, SEC-02.

2. **Transactions that return instead of throwing.** Drizzle commits a
   transaction whose callback *returns*; only a throw rolls back. Two places
   compute a failure result and `return` it after having already mutated
   rows. → ECM-01 (and the same shape lurks in `mergeGuestCartIntoUserCart`,
   which has no transaction at all → ECM-09).

3. **The docs are one commit ahead of the code.** `spec.md`, `plan.md` and
   `architecture.md` assert ISR, security headers, a health check, canonical/OG
   metadata, component tests, axe-in-CI, Zustand and a feature-flag UI. None
   of those exist. The docs are excellent and should not be deleted — they
   should be either implemented or explicitly marked deferred, the way Phase
   2.2 (GitHub OAuth) already is. → ARCH-01, ARCH-03, SEC-03, CFG-03, CFG-05,
   SEO-01, TST-01, TST-02.

4. **Validation stops at "is it the right type".** Every boundary runs Zod,
   which is genuinely good. But no schema bounds a string's length, no schema
   bounds a numeric range against the underlying `integer` column, and
   `.parse()` throws rather than returning a typed result — contradicting
   `plan.md` §20. → SEC-07, BE-02, VAL-*.

---

## 6. Suggested reading order for the implementing agent

1. `11-improvement-plan.md` — the full catalogue.
2. `12-execution-order.md` — do the work in this order.
3. Dip into the per-area file when a finding needs more context; each finding
   appears in exactly one area file with full detail, and is summarised in
   the plan.
