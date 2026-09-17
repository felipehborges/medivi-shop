import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getOrderById } from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { OrderDetailCard } from "@/components/order-detail-card";
import { OrderActions } from "@/components/admin/order-actions";

export const metadata: Metadata = { title: "Order detail — Admin — Medivi Shop" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderById(db, id);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl"><LocalizedText text={"Order "} />{order.orderNumber}</h1>
        <OrderActions orderId={order.id} status={order.status} />
      </div>
      <OrderDetailCard order={order} />
    </div>
  );
}
