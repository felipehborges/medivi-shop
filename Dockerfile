# Legacy commercial deployment for apps/web. The active frontend is apps/demo.
# Multistage build for apps/web — for
# the self-host Docker Compose target. Vercel deploys directly from source
# and does not use this file (see docs/architecture.md §10).

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /repo

# --- deps: install once, reused by builder ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/email/package.json packages/email/package.json
COPY packages/payments/package.json packages/payments/package.json
COPY packages/ratelimit/package.json packages/ratelimit/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# --- builder: compile the Next.js standalone output ---
FROM base AS builder
COPY --from=deps /repo /repo
COPY . .
ENV DOCKER_BUILD=1
ENV NODE_ENV=production
# Build-time-only placeholders — `env.ts` validates shape (a well-formed URL,
# a 32+ char secret), not reachability. Nothing at build time queries the
# database or sends email; real values are supplied at container runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV BETTER_AUTH_SECRET=docker-build-time-placeholder-not-a-real-secret
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
RUN pnpm --filter @medivi/web build

# --- runner: minimal runtime image ---
FROM node:24-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
