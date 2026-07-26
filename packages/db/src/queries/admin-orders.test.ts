import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import { auditLog, order, user, type OrderStatus } from "../schema";
import { markOrderFulfilledAdmin } from "./admin-orders";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const shippingAddress = {
  fullName: "Test",
  line1: "1 Way",
  city: "Town",
  region: "Region",
  postalCode: "00001",
  country: "US",
};

async function makeActor(tx: Tx) {
  const uid = unique("admin");
  const [actor] = await tx.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com`, role: "admin" }).returning();
  return actor!.id;
}

async function makeOrder(tx: Tx, status: OrderStatus) {
  const [row] = await tx
    .insert(order)
    .values({
      orderNumber: unique("MDV"),
      guestEmail: "guest@example.com",
      status,
      subtotalCents: 1000,
      totalCents: 1000,
      shippingAddress,
    })
    .returning();
  return row!.id;
}

describe("markOrderFulfilledAdmin", () => {
  it("moves a paid order to fulfilled and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const orderId = await makeOrder(tx, "paid");

      const result = await markOrderFulfilledAdmin(tx, actorId, orderId);
      expect(result).toEqual({ ok: true });

      const [row] = await tx.select({ status: order.status }).from(order).where(eq(order.id, orderId));
      expect(row?.status).toBe("fulfilled");

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, orderId), eq(auditLog.action, "order.fulfill")));
      expect(logs).toHaveLength(1);
    });
  });

  it("rejects a pending order — only paid orders can be fulfilled", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const orderId = await makeOrder(tx, "pending");

      const result = await markOrderFulfilledAdmin(tx, actorId, orderId);
      expect(result).toEqual({ ok: false, reason: "invalid_state" });
    });
  });
});
