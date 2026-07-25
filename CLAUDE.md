# CLAUDE.md — Medivi Shop

Fictional medieval/fantasy e-commerce portfolio project. Full spec/plan/tasks
live in `docs/` — read those before starting new feature work, don't
re-derive decisions already made there.

- [docs/spec.md](docs/spec.md) — product spec, non-goals, edge cases
- [docs/architecture.md](docs/architecture.md) — system design, data model, flows
- [docs/adr/0001-stack-choice.md](docs/adr/0001-stack-choice.md) — why this stack
- [docs/plan.md](docs/plan.md) — stack versions, per-domain approach
- [docs/tasks.md](docs/tasks.md) — the build order; work one checkbox at a time

## Workflow rules

- Work through `docs/tasks.md` one task at a time, in order (dependencies
  matter — don't jump to Admin before Auth+Catalog exist). Check the box and
  summarize the diff when a task is done.
- Every task must be validated (test or manual check) before moving to the
  next one. No "I'll come back and test this later."
- Don't skip ahead to code before a doc decision exists for it. If a new
  decision is needed mid-implementation, add it to the relevant doc first.
- Keep diffs focused — one task's scope, not opportunistic refactors.

## Non-negotiable architecture rules

- **Payment status only ever changes via a verified webhook**
  (`packages/payments`), never from a client redirect/return URL. This is the
  most common shortcut — do not take it, even temporarily.
- Payments, email, and file storage are always accessed through their
  provider interface (`PaymentProvider`, `EmailProvider`, `StorageProvider`)
  — never call Stripe/Resend/Blob SDKs directly from app code.
- All server-side entry points (Server Actions, Route Handlers) validate
  input with Zod before touching the database. Client-side validation is UX
  only, never trusted.
- Every admin-only server action re-checks the caller's role itself — never
  rely on middleware or layout guards alone.
- No raw string-interpolated SQL. Drizzle's query builder only.
- Order/cart line items snapshot price/name at write time — never re-joined
  live from `Product` after the fact.

## Folder conventions

- `apps/web` — the only deployable; `packages/*` are internal, non-published.
- `packages/db` owns all schema/migrations. Schema changes always go through
  a Drizzle migration, never a manual DB edit.
- Route groups: `(storefront)`, `(account)`, `(admin)` under `apps/web/app`.
- Shared UI primitives go in `packages/ui`; app-specific composed components
  stay in `apps/web/components`.

## Coding style

- TypeScript strict mode everywhere; no `any` without a comment explaining
  why it's unavoidable.
- Prefer Server Components; a component becomes a Client Component only when
  it needs interactivity/state, not by default.
- No comments explaining *what* code does — name things well instead. Only
  comment non-obvious *why* (a workaround, an invariant, a subtle constraint).
- Don't add error handling/fallbacks for cases that can't happen. Validate
  at boundaries (user input, webhooks), trust internal code past that point.

## Commands

```bash
pnpm install          # install all workspace deps
pnpm dev              # run apps/web dev server
pnpm build            # build all packages + app
pnpm lint             # eslint across the workspace
pnpm typecheck        # tsc --noEmit across the workspace
pnpm test             # vitest (unit/component)
pnpm test:e2e         # playwright (requires PAYMENT_PROVIDER=mock)
pnpm db:migrate       # apply drizzle migrations
pnpm db:seed          # seed fantasy catalog + admin user
docker compose -f docker/docker-compose.yml up   # local Postgres/Redis/MinIO
```

## Testing expectations

- Every task in `docs/tasks.md` ships with the test(s) listed for it — cart
  math, stock concurrency, webhook idempotency, and access-control checks
  (non-admin hitting admin actions) are the ones most likely to be skipped
  under time pressure; don't skip them.
- E2E tests always run against `PAYMENT_PROVIDER=mock` — never depend on a
  live Stripe sandbox in CI.
- New Server Actions or Route Handlers need at least one test before the
  task is marked done.
