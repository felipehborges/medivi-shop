import { and, count, desc, eq } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { auditLog, order, user, type OrderStatus } from "../schema";

const DEFAULT_PAGE_SIZE = 20;

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customer: string;
  totalCents: number;
  currency: string;
  createdAt: Date;
};

export type AdminOrderListParams = {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
};

export type AdminOrderListResult = {
  items: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listOrdersAdmin(
  db: DbClient,
  params: AdminOrderListParams = {},
): Promise<AdminOrderListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = params.status ? eq(order.status, params.status) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(order).where(where);
  const total = totalRow?.total ?? 0;

  const rows = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      guestEmail: order.guestEmail,
      userEmail: user.email,
      totalCents: order.totalCents,
      currency: order.currency,
      createdAt: order.createdAt,
    })
    .from(order)
    .leftJoin(user, eq(user.id, order.userId))
    .where(where)
    .orderBy(desc(order.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const items = rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    customer: row.guestEmail ?? row.userEmail ?? "unknown",
    totalCents: row.totalCents,
    currency: row.currency,
    createdAt: row.createdAt,
  }));

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type FulfillOrderResult = { ok: true } | { ok: false; reason: "invalid_state" };

/** Enforces the order status machine server-side: only a `paid` order can move to `fulfilled` (see docs/plan.md §9). */
export async function markOrderFulfilledAdmin(
  db: DbClient,
  actorId: string,
  orderId: string,
): Promise<FulfillOrderResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(order)
      .set({ status: "fulfilled", updatedAt: new Date() })
      .where(and(eq(order.id, orderId), eq(order.status, "paid")))
      .returning({ id: order.id });
    if (!row) return { ok: false, reason: "invalid_state" };

    await tx.insert(auditLog).values({
      actorId,
      action: "order.fulfill",
      entityType: "order",
      entityId: orderId,
      diff: { from: "paid", to: "fulfilled" },
    });
    return { ok: true };
  });
}
