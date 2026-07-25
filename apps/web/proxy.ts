import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (still referred to as
 * "middleware" in most of our docs/comments, since that's the concept).
 * This only checks that a session cookie is present — a fast, DB-free
 * redirect for the common case. It does NOT check role, so it cannot tell
 * a customer from an admin; the real enforcement is `requireUser`/
 * `requireAdmin` inside each protected Server Component/Action, which this
 * is a fast path in front of, not a replacement for (see CLAUDE.md).
 */
export function proxy(request: NextRequest) {
  const hasSession = !!getSessionCookie(request);

  if (!hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
