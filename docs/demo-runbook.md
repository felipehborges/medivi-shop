# Medivi portfolio demo

The portfolio deployment is the static, backend-free application in
`apps/demo`. The commercial full-stack implementation remains in `apps/web`
and the backend workspace packages remain unchanged.

## Local development

```bash
pnpm --filter @medivi/demo dev
```

No `.env`, database, Docker container, or provider account is required.
Cart, wishlist, simulated orders, and admin visibility changes are stored in
the browser under `medivi-demo-state-v1` and can be cleared from the demo admin
screen.

## Verification

```bash
pnpm --filter @medivi/demo lint
pnpm --filter @medivi/demo typecheck
pnpm --filter @medivi/demo test
pnpm --filter @medivi/demo test:e2e
pnpm --filter @medivi/demo build
```

The production build uses Next.js static export and writes `apps/demo/out`.
There are no application API routes and the E2E purchase journey fails if it
observes a request to `/api/**`.

## Vercel project

Import this GitHub repository as a new or existing Vercel project and set:

- Root Directory: `apps/demo`
- Framework Preset: Next.js
- Install Command: automatic (`pnpm install` from the workspace lockfile)
- Build Command: automatic (`pnpm build` in the selected workspace)
- Environment Variables: none

Preview the generated URL before attaching a custom domain. Because the
application is a static export, rollback is simply promoting the previous
Vercel deployment.

## Resuming the commercial version

The commercial app still lives in `apps/web`; use `docs/runbook.md` for its
Postgres, authentication, payment, email, storage, and deployment setup. The
demo neither imports nor comments out that implementation, so it can continue
evolving independently.
