import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@medivi/db/client";
import { recordAnalyticsEvent } from "@medivi/db/queries";
import { getSession } from "@/lib/auth-guards";
import { getOrCreateAnalyticsSessionId } from "@/lib/analytics-session";

const trackSchema = z.object({
  type: z.enum(["page_view", "add_to_cart", "wishlist_add", "checkout_started", "checkout_completed", "search_performed"]),
  path: z.string().max(2048).optional(),
});

/**
 * Not React-invoked (called from the client beacon via `fetch`), so it's a
 * Route Handler rather than a Server Action — same reasoning as the Stripe
 * webhook (see docs/architecture.md §2). Best-effort: a malformed/failed
 * beacon never surfaces as a user-visible error, since losing an analytics
 * event is never worth breaking the page.
 */
export async function POST(request: Request) {
  const parsed = trackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const sessionId = await getOrCreateAnalyticsSessionId();
  const session = await getSession();
  await recordAnalyticsEvent(db, {
    sessionId,
    userId: session?.user.id,
    type: parsed.data.type,
    path: parsed.data.path,
  });

  return NextResponse.json({ ok: true });
}
