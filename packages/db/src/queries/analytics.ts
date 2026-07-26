import type { DbClient } from "../lib/db-client";
import { analyticsEvent, type AnalyticsEventType } from "../schema";

export type RecordAnalyticsEventInput = {
  sessionId: string;
  userId?: string | null;
  type: AnalyticsEventType;
  path?: string;
  metadata?: Record<string, unknown>;
};

/**
 * First-party event capture feeding the admin analytics dashboard's
 * conversion funnel (see docs/spec.md §"Analytics/telemetry"). Best-effort —
 * callers don't fail the user-facing action if this insert has a problem,
 * since a missed analytics event is never worth breaking a cart/checkout flow.
 */
export async function recordAnalyticsEvent(db: DbClient, input: RecordAnalyticsEventInput): Promise<void> {
  await db.insert(analyticsEvent).values({
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    type: input.type,
    path: input.path ?? null,
    metadata: input.metadata ?? null,
  });
}
