import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getOrderForUser } from "@medivi/db/queries";
import { requireUser } from "@/lib/auth-guards";
import { OrderDetailCard } from "@/components/order-detail-card";

export const metadata: Metadata = {
  title: "Order detail — Medivi Shop",
};

/**
 * `getOrderForUser` returns `null` both when the order doesn't exist and
 * when it belongs to someone else — 404 either way, so guessing a valid
 * order id belonging to another user reveals nothing (see docs/spec.md,
 * Phase 6 access-control requirement).
 */
export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getOrderForUser(db, id, user.id);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Order {order.orderNumber}</h1>
      <OrderDetailCard order={order} />
    </div>
  );
}
