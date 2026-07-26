import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { withTestTransaction } from "../test";
import { analyticsEvent, user } from "../schema";
import { recordAnalyticsEvent } from "./analytics";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

describe("recordAnalyticsEvent", () => {
  it("inserts an event row for an anonymous session", async () => {
    await withTestTransaction(async (tx) => {
      const sessionId = unique("session");
      await recordAnalyticsEvent(tx, { sessionId, type: "page_view", path: "/catalog" });

      const [row] = await tx.select().from(analyticsEvent).where(eq(analyticsEvent.sessionId, sessionId));
      expect(row?.type).toBe("page_view");
      expect(row?.path).toBe("/catalog");
      expect(row?.userId).toBeNull();
    });
  });

  it("attaches the signed-in user id when provided", async () => {
    await withTestTransaction(async (tx) => {
      const uid = unique("user");
      const [u] = await tx.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com` }).returning();
      const sessionId = unique("session");

      await recordAnalyticsEvent(tx, {
        sessionId,
        userId: u!.id,
        type: "add_to_cart",
        metadata: { variantId: "abc" },
      });

      const [row] = await tx.select().from(analyticsEvent).where(eq(analyticsEvent.sessionId, sessionId));
      expect(row?.userId).toBe(u!.id);
      expect(row?.metadata).toEqual({ variantId: "abc" });
    });
  });
});
