/**
 * Dynamically imports `@sentry/nextjs` only when actually needed — a
 * top-level `import * as Sentry` would pull the full client SDK into every
 * page's bundle even when no DSN is configured (this project's default,
 * since there's no real Sentry account). Gating behind the env check *and*
 * a dynamic import keeps that cost entirely off the wire in the common case.
 */
export async function captureException(error: unknown): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(error);
}
