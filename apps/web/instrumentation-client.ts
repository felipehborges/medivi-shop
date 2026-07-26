const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Dynamically imported so the Sentry client SDK is never fetched at all when
// no DSN is configured (this project's default) — a static top-level import
// would ship the full SDK to every page regardless of whether it's enabled.
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
    });
  });
}
