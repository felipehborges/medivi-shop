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

## Environment gotchas

- **Never put `NODE_ENV` in `.env`.** `apps/web`'s dev/build/start scripts
  wrap `next` with `dotenv-cli` pointed at the repo-root `.env` (Next only
  auto-loads `.env` files from its own app directory, not a monorepo root).
  If `.env` sets `NODE_ENV=development`, that gets force-injected into
  `next build` too, which loads development-mode React into a production
  bundle and fails with a confusing `Cannot read properties of null
  (reading 'useContext')` error during static generation — not a code bug,
  an env-loading one. Let each command set `NODE_ENV` itself.
- Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
  (default/`proxy` named export, Node.js runtime by default now). Docs here
  still say "middleware" for the concept; the actual file is
  `apps/web/proxy.ts`.
- **Never re-export a type through a `"use server"` file**, even a type-only
  `export type { X }`. Next's dev-mode server-actions bundler tries to treat
  every re-export clause as an action reference regardless of the `type`
  keyword, and throws `ReferenceError: X is not defined` at request time —
  `next build`'s production bundler doesn't hit this path, so it only shows
  up in `next dev`. If a Server Action's input type needs to be shared with
  a client form, put the type (and its Zod schema) in a plain module the
  action file imports from, and have the client import it from there too —
  never from the action file itself.
- **drizzle-orm wraps the real postgres.js error in `.cause`.** A failed
  query throws a `DrizzleQueryError` (message: `"Failed query: ..."`), not
  the underlying `PostgresError` — the actual `code`/`constraint_name`
  fields (`23505` unique violation, `23503` FK violation, `23514` check
  violation) live on `err.cause`, not on `err` itself. Checking
  `err.code`/`err.constraint_name` directly always misses and silently
  rethrows instead of matching. Use the helpers in
  `packages/db/src/lib/pg-errors.ts` (`isUniqueViolation` /
  `isForeignKeyViolation` / `isCheckViolation`) rather than re-deriving this
  — they already unwrap `.cause`.
- **Adding a new `loading.tsx` under `(account)` or `(admin)` gets stuck on
  the fallback forever in this Next.js 16.2.11 + Turbopack dev setup** —
  reproduced on a group-root `loading.tsx` and repeated it on individual
  routes (`admin/orders`, `admin/users`, etc.), even a trivial
  `<div>Loading…</div>`, and even after clearing `.next` and a full cold
  server restart. The RSC payload for the real page is present in the HTML
  (verifiable via `document.body.innerHTML`) but never swaps in for the
  visible fallback — `pnpm build` and `next start` are unaffected, this is
  dev-only. `(storefront)/catalog` and `(storefront)/search`'s pre-existing
  `loading.tsx` files are unaffected (same Suspense/async-searchParams
  shape), so the trigger is something specific to `(account)`/`(admin)`,
  not `loading.tsx` in general — not root-caused. Until that's understood,
  don't add `loading.tsx` under those two groups; empty/error states there
  still work fine without one (see `docs/tasks.md` Phase 10.1).
- **Better Auth's `emailAndPassword.requireEmailVerification: true` changes
  more than sign-in.** Three non-obvious consequences, found the hard way in
  Phase 8:
  1. `signUp.email()` no longer establishes a session. A client flow that
     assumes auto-login after sign-up (calling a server action that requires
     a session, or redirecting to an authenticated page) silently breaks —
     in a browser with no other session it bounces to `/sign-in` via
     whatever guard the destination page has; in a browser that *does* have
     an unrelated valid session cookie lying around, it's worse: the new
     account gets created, but the old session stays active and the app
     proceeds as that other user. Don't assume a session exists post-sign-up
     — show a "check your email" state instead (see
     `app/(account)/sign-up/sign-up-form.tsx`) and let the cart merge happen
     at first real sign-in instead.
  2. `signIn.email()` for an unverified account throws an `APIError` with
     `error.code === "EMAIL_NOT_VERIFIED"` (status `FORBIDDEN`) — handle
     that code specifically to show a "resend verification email" action
     rather than a generic "invalid credentials" message.
  3. Signing up again with an email that's already registered does **not**
     throw a conflict error — Better Auth returns a non-persisted, fake-looking
     success response instead, deliberately avoiding leaking via an error
     message whether an email is taken (account enumeration). Only a
     duplicate signup against an *unverified* email is genuinely reprocessed
     as a retry. Don't write tests (or UI) that expect a hard rejection here
     — assert on DB state (no second row created) instead.

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
