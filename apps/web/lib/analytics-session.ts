import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "medivi_analytics_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/**
 * Purely a correlation id for the analytics funnel (see docs/spec.md
 * §"Analytics/telemetry") — unsigned, not security-sensitive, unlike the
 * guest-cart cookie. Only callable from Server Actions/Route Handlers
 * (cookie writes aren't allowed from Server Component render).
 */
export async function getOrCreateAnalyticsSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  const sessionId = randomUUID();
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  return sessionId;
}
