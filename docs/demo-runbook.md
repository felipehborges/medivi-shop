# Medivi portfolio demo

The portfolio deployment is the static, backend-free application in
`apps/demo`. The commercial full-stack implementation remains in `apps/web`
and the backend workspace packages remain available for future use. Default
root commands and CI run the frontend only.

## Local development

```bash
pnpm install --filter @medivi/demo... --frozen-lockfile
pnpm dev
```

No `.env`, database, Docker container, or provider account is required.
Cart, wishlist, simulated orders, and admin visibility changes are stored in
the browser under `medivi-demo-state-v1` and can be cleared from the demo admin
screen.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The production build uses Next.js static export and writes `apps/demo/out`.
There are no application API routes and the E2E purchase journey fails if it
observes a request to `/api/**`.

## Vercel project

Import this GitHub repository as a new or existing Vercel project and set:

- Root Directory: `apps/demo`
- Framework Preset: Next.js
- Install Command: `pnpm install --filter @medivi/demo... --frozen-lockfile`
- Build Command: automatic (`pnpm build` in the selected workspace)
- Environment Variables: none

If publishing under a custom domain, set `NEXT_PUBLIC_DEMO_URL` to its full
HTTPS origin (for example, `https://shop.example.com`) before building. It is
used for the static sitemap, robots file, and social metadata. The default is
`https://medivi-shop.vercel.app`.

Preview the generated URL before attaching a custom domain. Because the
application is a static export, rollback is simply promoting the previous
Vercel deployment.

Check the home page, a product URL after a browser reload, the checkout
simulation, and the social preview on the final deployment URL. The CI workflow
runs the demo's Playwright purchase journey on pushes and pull requests.

## Resuming the commercial version

The commercial app still lives in `apps/web`; use `docs/runbook.md` for its
Postgres, authentication, payment, email, storage, and deployment setup. It is
disabled in the default commands and CI, while its source remains available.
