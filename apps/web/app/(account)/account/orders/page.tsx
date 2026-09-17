import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@medivi/db/client";
import { listOrdersForUser } from "@medivi/db/queries";
import { requireUser } from "@/lib/auth-guards";
import { formatPriceCents } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Order history — Medivi Shop",
};

export default async function OrderHistoryPage() {
  const user = await requireUser();
  const orders = await listOrdersForUser(db, user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl"><LocalizedText text={"Order history"} /></h1>

      {orders.length === 0 ? (
        <EmptyState title="No orders yet" description="Your past orders will show up here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted"
              >
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()} · {order.itemCount}{" "}
                    <LocalizedText text={order.itemCount === 1 ? "item" : "items"} />
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm capitalize text-muted-foreground">{order.status}</span>
                  <span className="font-display text-lg">
                    {formatPriceCents(order.totalCents, order.currency)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
