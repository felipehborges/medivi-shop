# ADR 0001: Stack Choice for Medivi Shop

Status: Accepted
Date: 2026-07-25

## Context

Medivi Shop is a greenfield, single-developer, portfolio-grade e-commerce
project (see [spec.md](../spec.md)). It needs to demonstrate production-level
engineering judgment, not just "a working demo" — while staying buildable and
maintainable by one person. Several stack decisions have multiple credible
options; this ADR records what was chosen, why, and what alternatives were
rejected. Version claims below were verified via web search on 2026-07-25
rather than assumed from training data, per project rules.

## Decision Drivers

- Portfolio credibility: choices should read as deliberate to a senior
  reviewer, not "whatever the tutorial used."
- Low operational overhead for a single maintainer (managed services over
  self-run infra where it doesn't sacrifice the "could run this myself"
  story).
- Type safety end-to-end (TypeScript, schema validation, typed DB queries).
- A clean seam for "swap the mock for a real provider later" (payments,
  email, storage).
- Must run well on both a serverless PaaS (Vercel) and a self-hosted Docker
  stack — this project deliberately supports both (see
  [architecture.md §10](../architecture.md#10-deployment-topology)).

## Decisions

### 1. Framework: Next.js (App Router) as a full-stack monolith

**Chosen:** Next.js 16.x (React 19.2, Turbopack default), deployed as one app
covering storefront, account area, admin dashboard, and API/webhook routes.

**Alternatives considered:**
- *Separate SPA (Vite/React) + standalone API (NestJS/Express).* More
  "textbook" separation of concerns, but for a single-tenant store it adds a
  second deployable, a second auth boundary, and CORS/session complexity with
  no real payoff — and it forfeits Next.js's SSR/ISR story, which directly
  serves the SEO and performance requirements in the spec.
- *Remix.* A legitimate peer to Next.js App Router; rejected mainly on
  ecosystem breadth (shadcn/ui, Better Auth, and the wider component
  ecosystem assume Next.js first) rather than a technical deficiency.

**Consequence:** Server Components + Server Actions do the job a separate
REST/GraphQL API would otherwise do; Route Handlers are reserved for
non-React callers (Stripe webhook, sitemap). See
[architecture.md §2](../architecture.md#2-request-time-architecture).

### 2. Database & ORM: PostgreSQL + Drizzle ORM

**Chosen:** PostgreSQL (Neon serverless in production, containerized locally)
with Drizzle ORM.

**Alternatives considered:**
- *Prisma.* Stronger historical DX (Prisma Studio, more mature migration
  tooling) and still a fine choice for a Node.js-runtime deployment. But its
  serverless story on Vercel either pays for Prisma Accelerate or accepts a
  heavier query-engine binary and cold starts; Drizzle has a ~12KB
  zero-binary client that works natively at the edge/serverless with no paid
  add-on. For a portfolio project meant to be cheaply/freely hostable, that
  tips the decision.
- *Raw SQL / Kysely.* Kysely was a close second (also lightweight,
  SQL-native); Drizzle was chosen for its more complete migration tooling
  (`drizzle-kit`) and slightly larger ecosystem/adapter support (including a
  first-party Better Auth adapter, see below).

**Consequence:** Schema is TypeScript-first in `packages/db`; no raw
string-interpolated SQL anywhere in the app (security requirement in
[spec.md §12](../spec.md#12-security-considerations)).

### 3. Auth: Better Auth

**Chosen:** Better Auth (email/password + GitHub OAuth), with its official
Drizzle adapter, storing users/sessions in the app's own Postgres.

**Alternatives considered:**
- *Auth.js / NextAuth v5.* The long-standing default for Next.js. As of
  mid-2026 it remains usable but its own maintainers now point new projects
  toward Better Auth, and it's OAuth-first with authorization (roles/RBAC)
  left for the app to build — which this project needs anyway (customer vs.
  admin).
- *Clerk / Auth0 (hosted).* Excellent DX but hosted-auth-as-a-service reads
  as "outsourced" for a project whose explicit purpose is demonstrating
  full-stack ownership; also adds a paid dependency and an external account
  requirement for anyone running the project locally.

**Consequence:** Role (`customer`/`admin`) lives on the app's own `User` row,
checked server-side in every admin server action, not just middleware — see
[architecture.md §11](../architecture.md#11-moduleaccess-boundaries).

### 4. Payments: Stripe, behind an in-repo abstraction

**Chosen:** Stripe Checkout Sessions (test mode) + webhooks as the sole
source of truth for payment confirmation, wrapped in a `PaymentProvider`
interface with a `MockProvider` for offline/dev/CI use.

**Alternatives considered:**
- *Hardcoding checkout as "always succeeds."* Explicitly rejected by the
  project requirements — this must model real payment-intent/status
  semantics.
- *Paddle / LemonSqueezy (merchant-of-record).* Reasonable alternatives for a
  real SaaS, but Stripe has the deepest documentation, the most predictable
  test-mode story, and is the de facto reviewer-recognizable choice for a
  portfolio piece.

**Consequence:** the return/redirect URL never flips an order to `paid` —
only a verified webhook event does. This is the single rule most likely to
be shortcut under time pressure, so it's called out again in
[CLAUDE.md](../../CLAUDE.md).

### 5. UI: Tailwind CSS v4 + shadcn/ui (Radix primitives)

**Chosen:** Tailwind CSS v4 (CSS `@theme` config) with shadcn/ui components
using the Radix-based "new-york" style.

**Alternatives considered:**
- *shadcn/ui's newer Base UI default.* shadcn/ui now defaults new projects to
  Base UI instead of Radix; Radix remains fully supported and is the more
  battle-tested/documented option as of this writing. Chosen for stability
  given this is a from-scratch build, not a migration.
- *Component library (MUI, Chakra, Mantine).* Faster initial output but
  fights a custom medieval/fantasy visual identity; shadcn/ui's
  copy-into-repo model gives full control over theming, which matters for a
  portfolio piece meant to look bespoke.

### 6. Monorepo: pnpm workspaces + Turborepo

**Chosen:** `pnpm` workspaces orchestrated by Turborepo, with one app
(`apps/web`) and five internal packages (`db`, `ui`, `payments`, `email`,
`config`).

**Alternatives considered:**
- *Flat single-package app.* Simpler, but blurs exactly the boundaries the
  spec cares about demonstrating (payment/email/storage as swappable
  providers, schema as a reviewable unit). Rejected because the boundary
  *is* the point, not overhead for its own sake.
- *Nx.* Comparable capability to Turborepo; Turborepo chosen for lighter
  configuration and tighter Vercel integration (same vendor), which matters
  for the primary deployment target.

**Consequence:** only `apps/web` is ever deployed; packages are versioned
together (no publishing), so this stays a "monorepo for boundaries," not a
"monorepo for independent release trains."

## Consequences Summary

| Layer | Choice | Primary reason |
|---|---|---|
| Framework | Next.js 16 (App Router) | SSR/ISR for SEO+perf, one deployable |
| Language | TypeScript (strict) | end-to-end type safety |
| Database | PostgreSQL (Neon prod / Docker local) | relational integrity, portable |
| ORM | Drizzle | serverless-friendly, no paid add-on, SQL-native |
| Auth | Better Auth | first-party session control, current best practice |
| Payments | Stripe + abstraction | test-mode fidelity, real webhook semantics |
| Styling | Tailwind v4 + shadcn/ui (Radix) | bespoke theming, accessible primitives |
| Monorepo | pnpm + Turborepo | enforces the provider-swap boundaries the spec requires |

Full stack details, versions, and per-domain technical approach are in
[plan.md](../plan.md).
