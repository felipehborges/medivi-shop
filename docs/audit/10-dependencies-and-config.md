# 10 — Dependencies, configuration, CI/CD

Findings: `CFG-01` … `CFG-12`.

---

## 1. Toolchain summary

| Concern | Choice | Assessment |
|---|---|---|
| Package manager | pnpm 11.14.0, pinned via `packageManager` | ✅ correct, and `pnpm-lock.yaml` is committed |
| Monorepo | Turborepo 2.10 | ✅ task graph is correct (`^build` deps, `cache:false` on dev/db tasks) |
| Node | `engines: ">=24.0.0"`, `.nvmrc`, CI `node-version: 24` | ✅ consistent across all three |
| TypeScript | 5.9, `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride` | ✅ genuinely strict; **zero `any` in application code** (verified by grep) |
| Lint | ESLint 9 flat config, `typescript-eslint` recommended + `eslint-config-next` | ⚠️ no type-aware rules (CFG-07) |
| Format | **none** | ⚠️ CFG-06 |
| Build | Next 16.2.11, Turbopack | ✅ |
| Container | multistage `Dockerfile`, `output: "standalone"` gated on `DOCKER_BUILD` | ✅ good pattern; ~310 MB image |
| CI | GitHub Actions, 2 jobs | ⚠️ CFG-05, CFG-11 |

**`turbo.json` review:** correct. `build` depends on `^build`; `test:e2e`
depends on its own `build` (not `^build`) which is right because Playwright
needs the app built; `db:migrate`/`db:seed`/`dev` are uncached. One gap:
`test` depends on `^build` but has no `inputs`/`outputs` declared, so Turbo
caches it on the whole workspace hash — acceptable.

**No `any` anywhere.** I grepped `apps/` and `packages/` for `: any`,
`as any`, `<any>` — zero hits outside `node_modules`. That is unusual and
worth preserving.

---

## CFG-01 `NEXT_PUBLIC_APP_URL` is frozen to `http://localhost:3000` in the Docker image

**Confidence: Confirmed**

### Localização

- `Dockerfile:34` — `ENV NEXT_PUBLIC_APP_URL=http://localhost:3000` (build stage)
- `docker/docker-compose.prod.yml:26` — `NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}` (**runtime**)
- `apps/web/lib/auth-client.ts:6` — `baseURL: process.env.NEXT_PUBLIC_APP_URL` in a `"use client"` module
- `docs/runbook.md:15` — documents the variable as if it were runtime-configurable

### Problema

Next.js **inlines `NEXT_PUBLIC_*` variables into the client bundle at build
time**. They are literal string substitutions, not runtime lookups.

The Dockerfile builds with the placeholder `http://localhost:3000`
(`Dockerfile:34`). The compose file then sets the real value as a **runtime**
environment variable — which has no effect on code that was already compiled.

The concrete break is `auth-client.ts`:

```ts
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,   // → "http://localhost:3000" in the bundle
});
```

Every client-side auth call — `signIn.email`, `signUp.email`, `signOut`,
`sendVerificationEmail`, `requestPasswordReset`, `resetPassword` — is issued
against `http://localhost:3000/api/auth/*` from the visitor's browser. On any
deployment not literally at `localhost:3000` that is either a connection
refusal, a mixed-content block (page on `https:`, request to `http:`), or a
CORS failure.

**Server-side code is unaffected**, and that asymmetry is what makes this
hard to spot: `apps/web/lib/env.ts` reads `process.env` dynamically via
`Object.entries(process.env)` (`env.ts:48-53`), so it cannot be statically
inlined and picks up the true runtime value. So `successUrl`, order-email
links, `sitemap.xml` and JSON-LD are all **correct**, while sign-in silently
fails. Half the app works.

The Vercel path is unaffected — Vercel sets project env vars at build time, so
the inlined value is right.

### Cenário que reproduz o problema

Follow `runbook.md` §"Deploying via Docker Compose" on a host reachable at
`https://shop.example`:

```bash
NEXT_PUBLIC_APP_URL=https://shop.example \
  docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

Browse to `https://shop.example` — the storefront renders correctly, product
links and the sitemap all use `https://shop.example`. Click **Sign in**, fill
the form, submit. The browser attempts
`POST http://localhost:3000/api/auth/sign-in/email`. It fails (blocked as
mixed content, or refused). The form shows nothing useful.

Verify the root cause directly:
```bash
docker compose -f docker/docker-compose.prod.yml exec app \
  grep -rl "localhost:3000" apps/web/.next/static/chunks | head
```

### Impacto

- Segurança: baixo (mixed-content blocking is a *symptom*, not a hole)
- **Correção: alto** — authentication is entirely non-functional on the
  self-host target
- Performance: nenhum
- Manutenção: alto (the docs describe behaviour the build cannot deliver)
- **UX: crítico** — nobody can sign in or sign up

### Severidade

**P1**

### Recomendação

Pick one. **Option A is strongly preferred** — it removes the variable from
the client entirely.

**A. Don't put the origin in the client bundle at all.**
`createAuthClient` defaults to the current page's origin when `baseURL` is
omitted. That is always correct, in every environment, with no configuration:

```ts
// apps/web/lib/auth-client.ts
export const authClient = createAuthClient();   // same-origin
```
Confirm against the installed `better-auth@^1.6.25` that omitting `baseURL`
resolves to `window.location.origin` for a same-origin API — it is the
documented default, but **verify before shipping**.

Then audit for any other `NEXT_PUBLIC_*` read in client code. Current
inventory: `NEXT_PUBLIC_APP_URL` (this file only, on the client) and
`NEXT_PUBLIC_SENTRY_DSN` (`instrumentation-client.ts:1`,
`lib/monitoring.ts:9`). The Sentry DSN has the same build-time problem — a
self-host deployment cannot configure Sentry at runtime — but it fails safe
(no DSN → no Sentry), so it is a lesser issue. Document it.

**B. Accept the build-time nature and make it explicit.**
Pass it as a Docker build argument:
```dockerfile
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
```
```yaml
build:
  context: ..
  dockerfile: Dockerfile
  args:
    NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
```
and update `runbook.md` to state that changing `NEXT_PUBLIC_APP_URL` requires
a **rebuild**, not a restart. This works but leaves a foot-gun.

Regardless of choice, add to `runbook.md` §Environment variables a column
distinguishing **build-time** from **runtime** variables — that distinction is
currently absent and is the reason this shipped.

### Dependências

Independent. Should land before anyone attempts a real self-host deploy.

### Testes necessários

- Build the image with `NEXT_PUBLIC_APP_URL=https://shop.example`, then grep
  the emitted client chunks for `localhost:3000` — expect zero matches
  (Option B) or no origin at all (Option A).
- E2E against the container with `PLAYWRIGHT_BASE_URL` pointed at a non-3000
  host: sign-in completes.
- Unit: `authClient`'s resolved base URL is same-origin (Option A).

---

## CFG-02 Self-host product image URLs point at the internal `minio:9000` hostname

**Confidence: Confirmed**

### Localização

- `packages/storage/src/providers/s3.ts:53` — `return { url: \`${this.endpoint}/${this.bucket}/${key}\` }`
- `docker/docker-compose.prod.yml:34` — `S3_ENDPOINT: http://minio:9000`
- `apps/web/next.config.ts:14-19` — `remotePatterns` allows `localhost:9000` only
- `docker/docker-compose.prod.yml:71-84` — the `minio` service publishes **no ports**

### Problema

`S3Provider.upload` builds the returned URL from `this.endpoint`, which is the
**server-side** endpoint used by the S3 SDK. In the production compose stack
that is `http://minio:9000` — a Docker-network-internal hostname.

That URL is then persisted into `product_image.url` and rendered by
`next/image` in the browser. Three separate failures stack:

1. **The browser cannot resolve `minio`.** It is a compose service name, valid
   only inside the Docker network.
2. **The MinIO service publishes no ports** in `docker-compose.prod.yml`
   (unlike the dev compose, which publishes 9000/9001). Even with a correct
   hostname there is nothing to reach.
3. **`next.config.ts` does not allowlist it.** `remotePatterns` contains
   `localhost:9000`, not `minio:9000` — so `next/image` rejects the URL before
   the network is even attempted (the same failure mode as **IMG-01**).

Consequence: every product image uploaded through the admin UI on a self-host
deployment is broken, and — per IMG-01 — likely takes the rendering page down
rather than showing a broken image.

This wasn't caught because `tasks.md` 7.2 validated uploads against the **dev**
compose stack (`S3_ENDPOINT=http://localhost:9000`, ports published,
hostname allowlisted), and `tasks.md` 11.6 validated the prod stack against
**seeded** catalog data, whose images come from `picsum.photos`.

### Cenário que reproduz o problema

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
# migrate + seed per the runbook, then:
```
Sign in as admin → `/admin/products/<id>` → upload a valid 800×800 PNG. The
upload succeeds (the app can reach `minio:9000`). `product_image.url` is
`http://minio:9000/medivi-shop/<uuid>-photo.png`. Now open the product page as
a customer.

### Impacto

- Segurança: nenhum
- **Correção: alto** — admin image upload is non-functional on the self-host
  target
- Performance: nenhum
- Manutenção: médio
- **UX: alto** — broken (or page-breaking) images

### Severidade

**P1**

### Recomendação

Separate the **internal** endpoint (used by the SDK) from the **public** URL
base (persisted and served to browsers):

1. Add `S3_PUBLIC_URL` to `lib/env.ts` (optional; defaults to `S3_ENDPOINT`
   for backward compatibility) and to `S3ProviderConfig`:
   ```ts
   export type S3ProviderConfig = {
     endpoint: string;        // SDK target, e.g. http://minio:9000
     publicUrl?: string;      // browser-facing base, e.g. https://cdn.shop.example
     accessKeyId: string; secretAccessKey: string; bucket: string;
   };
   // upload():
   return { url: `${this.publicUrl ?? this.endpoint}/${this.bucket}/${key}` };
   ```
   `delete()` must strip the key using the **same** base — fix both together
   (see TST-06, which specifies the test).
2. Set `S3_PUBLIC_URL` in `docker-compose.prod.yml` and publish MinIO's port,
   or (better) put MinIO behind the same reverse proxy as the app and use a
   path/subdomain.
3. **Derive `remotePatterns` from a single shared hostname list** — the same
   module IMG-01 and SEC-03's CSP `img-src` need. `next.config.ts` cannot read
   `lib/env.ts` (it runs before the app), but it can read `process.env`
   directly and build the pattern from `S3_PUBLIC_URL`.
4. **The MinIO bucket must be public-read** for these URLs to work at all —
   see CFG-04.
5. Document the whole chain in `runbook.md`: an S3-compatible bucket needs an
   internal endpoint, a public base URL, a bucket, and a public-read policy.
   None of those four is currently mentioned.

### Dependências

- **CFG-04** (bucket creation/policy) must land with this or images still 403.
- Shares the hostname module with **IMG-01** and **SEC-03**. Do CFG-02 first.

### Testes necessários

- Unit (`packages/storage`, per TST-06): with `endpoint: "http://minio:9000"`
  and `publicUrl: "https://cdn.example"`, `upload` returns a `cdn.example` URL
  and `delete` extracts the correct key from it.
- Integration against the prod compose stack: upload an image, `curl` the
  returned URL from **outside** the Docker network, expect 200.
- E2E: the uploaded image renders on the product page.

---

## CFG-03 The documented `/api/health` route does not exist, and the app container has no healthcheck

**Confidence: Confirmed** · **Severidade: P2**

### Localização

- `docs/plan.md` §19, final bullet — *"Health check route (`/api/health`)
  verifying DB connectivity, used by Docker Compose healthchecks in self-host
  mode. (Deferred to Phase 11 alongside the production Dockerfile/compose file
  it's meant to serve.)"*
- `docs/tasks.md` 11.6 — marked `[x]` done; the health check is not mentioned
- `apps/web/app/api/` — contains `auth/`, `webhooks/`, `analytics/`. No `health/`
- `docker/docker-compose.prod.yml:9-41` — the `app` service has **no**
  `healthcheck` block (postgres, redis and minio all do)
- `Dockerfile` — no `HEALTHCHECK` instruction

### Problema

The route was explicitly deferred *to* Phase 11, and Phase 11 shipped without
it. Consequences:

- `depends_on: condition: service_healthy` works for the three backing
  services, so the app waits for them ✅ — but **nothing waits for the app**.
  Docker reports the container "running" the instant the process starts,
  before Next has bound a port or reached Postgres.
- A rolling update (`docker compose up -d --build app`, `runbook.md`
  §"Updating") gives no signal of whether the new container is actually
  serving. If it crash-loops on a bad env var, `docker compose ps` shows
  `restarting` but nothing tells you why or when it recovered.
- There is no readiness endpoint for a load balancer or uptime monitor.

### Recomendação

1. Create `apps/web/app/api/health/route.ts`:
   ```ts
   export const dynamic = "force-dynamic";
   export async function GET() {
     try {
       await db.execute(sql`select 1`);
       return NextResponse.json({ status: "ok" });
     } catch {
       return NextResponse.json({ status: "degraded" }, { status: 503 });
     }
   }
   ```
   Return **no** version/commit/env detail — it is an unauthenticated
   endpoint. Add `/api/health` to `robots.ts`'s disallow list (it is already
   covered by `/api`).
2. Add a compose healthcheck:
   ```yaml
   healthcheck:
     test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
     interval: 10s
     timeout: 5s
     retries: 5
     start_period: 20s
   ```
   (`wget`/`curl` are not in `node:24-alpine`; using `node` avoids adding a
   package to the runtime image.)
3. Keep it cheap — a `select 1`, not a full query. It runs every 10 s forever.
4. Update `plan.md` §19 to drop the "(Deferred)" note once it exists.

### Testes necessários

- Integration: `GET /api/health` returns 200 with a reachable DB.
- Integration: with the DB pointed at an unreachable host, it returns 503 and
  does not throw.
- Manual: `docker compose ps` shows the app as `healthy`.

---

## CFG-04 The MinIO bucket is never created and never made readable

**Confidence: Confirmed** · **Severidade: P2**

### Localização

- `docker/docker-compose.yml:34-50` and `docker/docker-compose.prod.yml:71-84`
  — the `minio` service runs `server /data` with no init step
- `.env.example:39` — `S3_BUCKET=medivi-shop`
- `packages/storage/src/providers/s3.ts:45-52` — `PutObjectCommand` assumes
  the bucket exists
- `docs/runbook.md` §"Deploying via Docker Compose" — steps 1–5 never mention
  the bucket

### Problema

Two missing setup steps that no document covers:

1. **The bucket is never created.** MinIO starts empty. The first admin image
   upload fails with `NoSuchBucket`, surfacing as an unhandled throw in the
   Server Action → 500 in the admin form.
2. **Even once created, MinIO buckets are private by default.** `S3Provider`
   uploads with no ACL and the compose stack sets no bucket policy. The URL
   returned by `upload()` is a plain unauthenticated `GET`, which will 403.
   Making it work requires either a public-read policy or presigned URLs —
   neither exists.

`tasks.md` 7.2 records *"uploaded an image to a local MinIO bucket and deleted
it (confirmed removed from the bucket)"* — so the developer created and
configured the bucket manually and the step never made it into the runbook.
`spec.md` §8 makes *"deploys from a clean checkout with documented commands …
and no undocumented manual steps"* a success criterion.

### Recomendação

1. Add a one-shot init service to **both** compose files:
   ```yaml
   minio-init:
     image: minio/mc:latest
     depends_on: { minio: { condition: service_healthy } }
     entrypoint: >
       /bin/sh -c "
       mc alias set local http://minio:9000 $$MINIO_ROOT_USER $$MINIO_ROOT_PASSWORD &&
       mc mb --ignore-existing local/medivi-shop &&
       mc anonymous set download local/medivi-shop"
     environment:
       MINIO_ROOT_USER: medivi
       MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-medivi-local-dev}
   ```
   `mc anonymous set download` grants public read on objects only — the
   minimum needed for `<img src>` to work.
2. Make `S3Provider.upload` fail gracefully: catch the SDK error and return a
   typed result so the admin form shows "Storage is not configured" instead of
   a 500.
3. Document the bucket + policy requirement in `runbook.md` for anyone using a
   real S3/R2/Spaces bucket rather than the bundled MinIO.
4. **Decide** whether public-read is acceptable. It is fine for product
   photos. If not, switch to presigned GET URLs — a larger change (URLs would
   need regenerating, so they couldn't be persisted in `product_image.url`).
   Note the decision in `plan.md` §23.

### Testes necessários

- Manual/CI: `docker compose -f docker/docker-compose.prod.yml up -d` from a
  clean volume, then upload an image via the admin UI and `curl` the URL from
  the host → 200.

---

## CFG-05 CI has no Lighthouse and no accessibility gate, despite both being success criteria

**Confidence: Confirmed** · **Severidade: P2**

### Localização

- `.github/workflows/ci.yml` — 2 jobs: `build` (install → env → migrate →
  audit → lint → typecheck → test → build) and `e2e` (Playwright)
- `spec.md` §8 — *"Lighthouse scores (mobile, production build) ≥ 90 for
  Performance, Accessibility, Best Practices, SEO on `/`, `/catalog`,
  `/product/[slug]`"*
- `spec.md` §9 — *"Automated `axe-core` scans in CI on key pages"*
- `tasks.md` 9.4, 10.6 and 11 — Lighthouse deferred **three times**, each time
  for lack of a local Chrome

### Problema

Two of the project's own stated success criteria have never been measured, and
each deferral pointed at the next phase. Phase 11 was the last phase.

The blocker cited ("no Chrome available in this environment") no longer
applies in CI: the `e2e` job already runs
`playwright install chromium --with-deps` and starts a production server via
`playwright.config.ts`'s `webServer`. Both tools can attach to exactly that.

### Recomendação

1. **Lighthouse.** Add a step to the existing `e2e` job (after Playwright, so
   the server is warm), or a small dedicated job:
   ```yaml
   - name: Lighthouse
     uses: treosh/lighthouse-ci-action@v12
     with:
       urls: |
         http://localhost:3000/
         http://localhost:3000/catalog
         http://localhost:3000/product/iron-longsword
       configPath: ./lighthouserc.json
       uploadArtifacts: true
   ```
   with `lighthouserc.json` asserting `≥ 0.9` on all four categories under the
   mobile preset. Start with `"warn"` assertions for one run to see the real
   baseline, then flip to `"error"`.
   **Expect Performance to fail initially** — ARCH-01 (no caching) and
   PERF-04 (4 queries per request) are exactly what Lighthouse measures. That
   failing number is the point.
2. **Accessibility.** TST-02's axe spec. Run it on **pull requests**, not just
   `master` — a11y regressions are cheap to catch and expensive to find later.
3. **Split the CI triggers.** Today `e2e` requires
   `github.event_name == 'push' && github.ref == 'refs/heads/master'`
   (`ci.yml:84`), so a PR can break the purchase journey and merge green.
   Run at least the purchase journey + the a11y spec on PRs.

### Testes necessários

Self-referential. Acceptance: CI fails when a deliberate regression is
introduced (remove the root `<main>` → axe fails; add a 2 MB unoptimised
image → Lighthouse Performance drops).

---

## CFG-06 No formatter is configured

**Confidence: Confirmed** · **Severidade: P3**

### Localização

No `.prettierrc`, no `prettier` dependency, no `format` script in any
`package.json`, no formatting step in CI. `plan.md` implies one exists via the
"formatter" line in the config table.

### Problema

Formatting is consistent across the codebase today — it was clearly written
carefully — but nothing enforces it. Line-width, quote style and trailing
commas already vary slightly (compare
`packages/db/src/schema/ops.ts:1` at 96 chars against
`packages/db/src/schema/product.ts:1-13`, which is wrapped).

For a project whose value proposition includes reviewability, an unenforced
style is a slow leak.

### Recomendação

Add Prettier at the root with `prettier-plugin-tailwindcss` (this codebase has
long, hand-ordered Tailwind class strings that a plugin would normalise), a
`format` and `format:check` script, and a `format:check` step in CI **after**
lint. Use `eslint-config-prettier` to disable the ESLint rules that conflict.

Run the initial `--write` as its own commit so it doesn't pollute a feature
diff.

---

## CFG-07 No type-aware lint rules

**Confidence: Confirmed** · **Severidade: P3**

### Localização

`packages/config/eslint/base.mjs:10-22` — `tseslint.configs.recommended`
(not `recommendedTypeChecked`), no `parserOptions.project`.

### Problema

Type-aware rules require a `project` reference and are not enabled. The two
that would have caught real findings in this audit:

- **`@typescript-eslint/no-floating-promises`** — catches
  `void captureException(error)` misuse, unawaited Server Action calls, and the
  unhandled `checkoutAction(values)` rejection in **FE-01**.
- **`@typescript-eslint/no-misused-promises`** — catches
  `onSelect={handleSignOut}` (`user-menu.tsx:63`), where an async handler is
  passed to a sync-expecting prop.

Also worth adding: `switch-exhaustiveness-check`, which would have flagged the
non-exhaustive status handling in **ECM-10**.

### Recomendação

Enable `tseslint.configs.recommendedTypeChecked` in
`packages/config/eslint/base.mjs` with
`languageOptions.parserOptions: { projectService: true }`. Expect an initial
wave of findings; triage them (many will be legitimate `void`-prefixed
fire-and-forget calls that need an explicit comment). Add
`switch-exhaustiveness-check` as `error`.

Type-aware linting is slower — measure the CI impact; if it's material, run it
as a separate job rather than blocking the fast lint.

---

## CFG-08 Dependency hygiene

**Confidence: Confirmed** · **Severidade: P3**

| Issue | Localização | Assessment |
|---|---|---|
| `axe-core` is installed and never imported | `apps/web/package.json:43` | Either use it (TST-02, which needs `@axe-core/playwright` anyway) or remove it. Right now it is a dependency that makes CI look like it has an a11y gate. |
| `drizzle-orm` and `stripe` are `devDependencies` of `apps/web` but are used at runtime through `@medivi/db` / `@medivi/payments` | `apps/web/package.json:45, 49` | They are only imported for **types** in `apps/web` (verified), and the real runtime copies come from the workspace packages' own `dependencies`. Correct as written — but fragile: a future `import { sql } from "drizzle-orm"` in an app file would work in dev and could break a pruned production install. Consider moving them to `dependencies` for clarity, or add a comment. |
| `packages/ui` declares `react` and `react-dom` as `dependencies` | `packages/ui/package.json:22-23` | Should be `peerDependencies` (plus devDependencies for local typechecking). As `dependencies` in a pnpm workspace they resolve to the same hoisted copy today, so no duplicate React — but the declaration is wrong and would produce two React copies if versions ever diverged. |
| `packages/storage` has no `test` script | `packages/storage/package.json` | `turbo run test` silently skips it. See **TST-06**. |
| `packages/ui` has no `test` script | `packages/ui/package.json` | Intentional and fine (thin wrappers) — no action. |
| Versions are consistent across workspaces | all manifests | ✅ `react` 19.2, `typescript` 5.9, `eslint` 9.39, `vitest` 4.1, `drizzle-orm` 0.45.2 all match everywhere. Good discipline. |

---

## CFG-09 `pnpm audit` is informational and 11 high advisories are outstanding

**Confidence: Confirmed** · **Severidade: P3**

### Localização

`.github/workflows/ci.yml:63-68` — `run: pnpm audit --audit-level=high || true`

### Problema

The `|| true` makes the step advisory-only. `tasks.md` 11.5 documents the
reasoning and it is sound:

> *"a real audit run surfaced 11 high/3 moderate advisories, several with no
> patched version published yet on npm (e.g. `image-size`, pinned to the
> latest available release already) — a hard failure would permanently red-X
> CI on issues nobody can currently fix."*

That is the right call. What is missing is any mechanism to notice when a
patch **does** become available, or to distinguish "known and accepted" from
"new and unexamined". Dependabot opens PRs for version bumps but does not
track advisory acceptance, and the audit output scrolls past in the log.

Note `image-size` is used at `apps/web/lib/actions/admin-products.ts:87` to
validate uploaded images — it parses untrusted binary input, which is exactly
the sort of dependency whose advisories matter. It is admin-gated, which
bounds the exposure.

### Recomendação

1. Record the accepted advisories in a checked-in file (e.g.
   `.audit-allowlist.json` with advisory id, package, date accepted, reason,
   and a review date).
2. Change the CI step to fail on any **high** advisory **not** in the
   allowlist — so new ones break the build and known ones don't.
   `pnpm audit --json` plus a ~20-line script is enough; don't add a tool.
3. Add a quarterly review date to the allowlist entries.
4. For `image-size` specifically: consider validating dimensions with `sharp`
   (which is already a transitive Next dependency for image optimisation) and
   dropping `image-size` entirely.

---

## CFG-10 `runbook.md` points at the wrong migrations directory

**Confidence: Confirmed** · **Severidade: P3**

### Localização

`docs/runbook.md:157-158` — *"this project's migrations are Drizzle-generated
SQL files under `packages/db/drizzle/`"*.

Actual path: `packages/db/migrations/`, configured at
`packages/db/drizzle.config.ts:6` (`out: "./migrations"`).

### Problema

Small, but it is in the **rollback** section — the one an operator reads under
pressure, when a deploy has gone wrong. A wrong path there costs minutes at
the worst moment.

### Recomendação

Fix the path. While in that section, also add:
- that `drizzle-kit` does not emit `CREATE INDEX CONCURRENTLY`, so the DB-01
  index migration must be hand-edited for a table with real volume;
- that `packages/db/migrations/meta/` must be committed alongside the SQL, or
  `drizzle-kit generate` will produce a wrong diff next time.

---

## CFG-11 CI observations

**Confidence: Confirmed** · **Severidade: P3**

`.github/workflows/ci.yml` is otherwise well built (it correctly triggers on
`master` — a real bug fixed in `tasks.md` 11.4 — runs unit tests against an
ephemeral Postgres, and uploads Playwright reports). Remaining items:

| Item | Line | Assessment |
|---|---|---|
| Secrets are written to `.env` via `cat > .env <<EOF` with `${{ env.X }}` interpolation | 51-58, 116-123 | Works, and the values are non-secret CI placeholders. If real secrets are ever added, switch to `${{ secrets.X }}` written with `>>` and never echoed. Note the heredoc is unquoted (`<<EOF`, not `<<'EOF'`), so a value containing `$` would be shell-expanded. |
| `concurrency: cancel-in-progress: true` | 8-10 | Correct for PRs; on `master` it means a push can cancel the run that gates a deploy. Consider `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. |
| The `e2e` job re-installs and re-migrates from scratch | 100-126 | ~2 minutes of duplicated work. Acceptable; caching `.next` between jobs would help if CI time becomes a problem. |
| `pnpm/action-setup@v4` with no `version` | 39-40 | Correct — it reads `packageManager` from the root manifest. |
| Turbo remote cache not configured | — | Fine at this size. |
| No `STORAGE_PROVIDER` / S3 vars in CI | 51-58 | Defaults to `s3` with all S3 vars unset, so `getStorageProvider()` **would throw** if any test reached it. No test does — which means the admin image-upload path has no CI coverage at all (TST-07). Set `STORAGE_PROVIDER` explicitly and consider adding a MinIO service to the `e2e` job. |
| E2E runs only on `master` | 84 | See CFG-05.3. |

---

## CFG-12 Docker image review

**Confidence: Confirmed** · **Severidade: P3**

The `Dockerfile` is well constructed — multistage, non-root user, standalone
output gated behind `DOCKER_BUILD` so Vercel is unaffected, and the manifest
files copied before the source so the dependency layer caches. `.dockerignore`
excludes `node_modules`, `.next`, `.turbo`, `.git`, `docker`, `docs` and env
files (a real fix from `tasks.md` 11.6). Image is ~310 MB.

Remaining, all minor:

| Item | Localização | Recommendation |
|---|---|---|
| No `HEALTHCHECK` | `Dockerfile` | CFG-03 |
| No `TZ=UTC` | `Dockerfile:41-43` | Set it — see DB-02 |
| Dev dependencies are installed in `deps` and carried into `builder` | `Dockerfile:21` | Necessary for the build; the runner stage only copies `.next/standalone`, so they don't reach the final image. ✅ no action |
| Build-time placeholder secrets | `Dockerfile:32-34` | Clearly labelled and only used to satisfy `env.ts`'s shape validation at build. ✅ correct approach — but see **CFG-01**, where the `NEXT_PUBLIC_` one leaks into the client bundle |
| `.dockerignore` doesn't exclude `apps/web/e2e` or test files | `.dockerignore` | Marginal size win; they're excluded from the runtime image by `standalone` tracing anyway. Optional |
| No image scanning in CI | `.github/workflows/ci.yml` | Optional; `trivy` or `docker scout` on the built image would complement the `pnpm audit` step |
| The `builder` stage runs `pnpm --filter @medivi/web build` directly rather than `turbo run build` | `Dockerfile:35` | Fine — `@medivi/web`'s build doesn't depend on a `^build` from the packages (they're consumed as TypeScript source via `transpilePackages` / direct `exports`). ✅ no action |

---

## Environment variable reference (as actually implemented)

Cross-checked `lib/env.ts` against `.env.example`, `runbook.md`, the compose
files and CI. **Build-time vs runtime is the column `runbook.md` is missing.**

| Variable | Required | When read | Notes |
|---|---|---|---|
| `NODE_ENV` | — | runtime | Never set manually (documented; enforced only by convention) |
| `NEXT_PUBLIC_APP_URL` | default `http://localhost:3000` | **build** (client) / runtime (server) | **CFG-01** |
| `DATABASE_URL` | ✅ | runtime | Read twice, two code paths — **ARCH-02** |
| `BETTER_AUTH_SECRET` | ✅ min 32 | runtime | Also the HMAC key for the guest-cart cookie |
| `GITHUB_CLIENT_ID` / `_SECRET` | — | runtime | Declared in `env.ts`; **never used** (OAuth deferred, `tasks.md` 2.2) |
| `PAYMENT_PROVIDER` | default `mock` | runtime | Gates the provider object only — **SEC-01** |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | if `stripe` | runtime | Checked at first provider use, not at boot |
| `EMAIL_PROVIDER` | default `console` | runtime | |
| `RESEND_API_KEY` | if `resend` | runtime | |
| `EMAIL_FROM` | default | runtime | |
| `STORAGE_PROVIDER` | default `s3` | runtime | Not set in CI — **TST-07** |
| `S3_ENDPOINT` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` / `_BUCKET` | if `s3` | runtime | **CFG-02** needs a fifth: `S3_PUBLIC_URL` |
| `BLOB_READ_WRITE_TOKEN` | if `vercel-blob` | runtime | |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | — | runtime | Absent → in-process fallback |
| `SENTRY_DSN` | — | runtime (server) | |
| `NEXT_PUBLIC_SENTRY_DSN` | — | **build** (client) | Same build-time trap as CFG-01, but fails safe |
| `DOCKER_BUILD` | — | build | Gates `output: "standalone"` |
| *(proposed)* `TRUSTED_PROXY_HOPS` | — | runtime | **SEC-04** |
| *(proposed)* `S3_PUBLIC_URL` | — | runtime | **CFG-02** |
| *(proposed)* `DATABASE_POOL_MAX` | — | runtime | **DB-03** |

**Gap:** `env.ts` validates *shape* but not *coherence*. `PAYMENT_PROVIDER=stripe`
with no keys throws only at the first checkout, not at boot — contradicting
`plan.md` §22's *"the app fails fast at boot with a clear error"*. Add a Zod
`.superRefine` covering the four conditional groups (stripe, resend, s3,
vercel-blob) so misconfiguration is caught at startup.
