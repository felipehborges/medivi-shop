# Deployment Runbook

Two supported deploy targets — same `apps/web` image/source, different env
vars only (see [architecture.md §10](architecture.md)). Pick the section you
need.

## Environment variables

All variables are validated at boot by `apps/web/lib/env.ts` — a missing or
malformed required value fails fast with a clear error instead of a runtime
crash deep in a provider. Reference: `.env.example` at the repo root.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Public origin, e.g. `https://medivi.shop`. Also used by Better Auth to derive cookie security (`secure` iff `https://`). |
| `DATABASE_URL` | yes | Postgres connection string. |
| `BETTER_AUTH_SECRET` | yes | 32+ random chars. Generate: `openssl rand -base64 32`. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | no | GitHub OAuth sign-in, if enabled. |
| `PAYMENT_PROVIDER` | no (default `mock`) | `mock` or `stripe`. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | if `PAYMENT_PROVIDER=stripe` | From the Stripe dashboard. |
| `EMAIL_PROVIDER` | no (default `console`) | `console` or `resend`. |
| `RESEND_API_KEY` | if `EMAIL_PROVIDER=resend` | |
| `EMAIL_FROM` | no | Sender address for outgoing mail. |
| `STORAGE_PROVIDER` | no (default `s3`) | `s3` (MinIO/any S3-compatible) or `vercel-blob`. |
| `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` | if `STORAGE_PROVIDER=s3` | |
| `BLOB_READ_WRITE_TOKEN` | if `STORAGE_PROVIDER=vercel-blob` | Vercel Blob store token. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | Rate limiting backend. Unset → falls back to an in-process limiter (fine for a single instance, not for multiple). |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | no | Unset → Sentry code never loads (see plan.md §19). |
| `NODE_ENV` | **never set manually** | See CLAUDE.md — each command sets it itself; setting it in `.env` breaks production builds. |

## Deploying to Vercel (primary target)

One-time project setup:

1. Import the GitHub repo into a new Vercel project. Framework preset:
   Next.js. Root directory: repo root (Vercel auto-detects the `apps/web`
   workspace via `turbo.json`/`pnpm-workspace.yaml` — no custom build command
   needed beyond Vercel's default `pnpm build` at the root, which runs
   `turbo run build` and only actually builds what changed).
2. Provision a **Neon** Postgres project. Copy its pooled connection string
   into `DATABASE_URL`.
3. Provision an **Upstash** Redis database (REST API, not the native
   protocol). Copy the REST URL/token into `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN`.
4. Enable **Vercel Blob** for the project (Storage tab → Create → Blob).
   Copy the generated read/write token into `BLOB_READ_WRITE_TOKEN`, and set
   `STORAGE_PROVIDER=vercel-blob`.
5. Create a **Resend** API key, set `RESEND_API_KEY` and `EMAIL_PROVIDER=resend`.
6. Set every other required variable from the table above in Vercel's
   Project Settings → Environment Variables. Set `PAYMENT_PROVIDER=stripe`
   plus the two Stripe keys once a Stripe account is wired up; leave as
   `mock` until then.
7. Set the **Production** and **Preview** environments separately — Preview
   deployments (one per PR) should point at a *separate* Neon branch/database
   or a scratch DB, never the production one, since Playwright/manual
   testing against a preview URL will write real rows.

Every push to `master` after this triggers: GitHub Actions CI (lint,
typecheck, unit tests, E2E — see below) → on green, Vercel's own git
integration builds and promotes to production. Every PR gets its own preview
deployment automatically; CI runs lint/typecheck/unit/build on PRs but
**not** E2E (see `docs/plan.md` §18) — E2E only runs on `master`.

### Migrations on Vercel

Vercel does **not** run migrations on deploy — per the non-negotiable rule
in `docs/plan.md` §17, migrations run as an explicit step *before* the new
version can receive traffic, never on app boot (avoids concurrent-instance
migration races during a rolling deploy). Run manually (or as a separate
CI/CD step you gate the deploy on):

```bash
DATABASE_URL="<neon-connection-string>" pnpm --filter @medivi/db db:migrate
```

Run this **before** merging the PR that depends on the new schema, so the
already-running previous version and the about-to-deploy new version are
both compatible with the migrated schema for the brief overlap window.

## Deploying via Docker Compose (self-host)

For a fully offline demo/self-host instance — Postgres, Redis, and MinIO all
run as containers alongside the app; `PAYMENT_PROVIDER=mock` and
`STORAGE_PROVIDER=s3` (pointed at the local MinIO) are the natural defaults
here.

1. Copy `.env.example` to `.env` at the repo root and fill in
   `BETTER_AUTH_SECRET` (and anything else you want non-default — Stripe,
   Resend, Sentry). `DATABASE_URL`/S3 vars are already wired to the compose
   service names in `docker/docker-compose.prod.yml` and don't need to be
   set unless you're pointing at external services instead.
2. Build and start:
   ```bash
   docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
   ```
3. Run migrations against the now-running Postgres container (from the host,
   with `packages/db` deps installed — this project does not ship
   `drizzle-kit` inside the runtime image, by design, since migrations are
   never run from app boot):
   ```bash
   DATABASE_URL="postgresql://medivi:medivi@localhost:5432/medivi_shop" pnpm --filter @medivi/db db:migrate
   ```
   (Only needed the first time and after any schema change — the app
   container itself never runs this.)
4. Seed the fantasy catalog, if this is a fresh instance:
   ```bash
   DATABASE_URL="postgresql://medivi:medivi@localhost:5432/medivi_shop" pnpm --filter @medivi/db db:seed
   ```
5. The app is now up at `http://localhost:3000`.

### Updating a running self-host instance

```bash
git pull
DATABASE_URL="postgresql://medivi:medivi@localhost:5432/medivi_shop" pnpm --filter @medivi/db db:migrate   # 1. migrate first
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build app                          # 2. then roll the app container
```
Running migrations before rebuilding the app container is what makes this
safe even though there's a brief window where the old container is still
serving traffic against the new schema — migrations in this project are
always additive/backward-compatible for at least one deploy (never drop a
column in the same migration that stops writing to it).

## Rotating secrets

- **`BETTER_AUTH_SECRET`**: rotating this invalidates every existing session
  (Better Auth signs session cookies with it) — all users get signed out.
  Generate a new one (`openssl rand -base64 32`), set it in Vercel/`.env`,
  redeploy. Plan for a maintenance window or off-peak rotation.
- **`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`**: roll in the Stripe
  dashboard, update the env var, redeploy — no user-facing impact, but any
  webhook events sent between rotating the key in Stripe and updating the
  env var here will fail signature verification and need Stripe's automatic
  retry to pick them up once the new secret is live.
- **`RESEND_API_KEY`**: roll in Resend's dashboard, update, redeploy.
- **`UPSTASH_REDIS_REST_TOKEN`**: roll in Upstash's dashboard, update,
  redeploy. Rate limiting falls back to the in-process limiter for any
  request that races the redeploy — never a hard failure.
- **`S3_SECRET_ACCESS_KEY` / MinIO root password**: for self-host, update
  the MinIO container's env and the app's env together (a mismatch just
  breaks image uploads, not auth) and restart both.

## Rollback

**Vercel**: open the project's Deployments tab, find the last known-good
production deployment, and use "Promote to Production" — instant, no
rebuild. If the bad deploy included a migration, you may also need to roll
the schema back (see below) — check whether the previous app version's
queries are still compatible with the migrated schema before promoting.

**Self-host**:
```bash
git checkout <last-good-commit>
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build app
```

**Schema rollback**: this project's migrations are Drizzle-generated SQL
files under `packages/db/drizzle/`. Drizzle doesn't auto-generate a
`down` migration — write and run the inverse SQL by hand for the specific
migration you need to undo, test it against a copy of production data
first, and only do this if the forward migration genuinely broke something
that redeploying the previous app version doesn't already fix (most
first-deploy issues are a bad app build, not a bad schema).

## CI (reference)

See `.github/workflows/ci.yml`. On every push/PR: install → audit
(informational) → lint → typecheck → unit tests (against an ephemeral
Postgres service container) → build. On push to `master` only: the same,
plus a Playwright E2E job (`PAYMENT_PROVIDER=mock`, against its own
ephemeral Postgres, running `next build && next start` — not `next dev`,
which has a known Turbopack streaming bug unrelated to this app's code, see
`docs/tasks.md` Phase 10).
