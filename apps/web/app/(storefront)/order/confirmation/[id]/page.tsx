import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getOrderById } from "@medivi/db/queries";
import { Button } from "@medivi/ui/components/ui/button";
import { formatPriceCents } from "@/lib/format";
import { OrderStatusPoller } from "@/components/order-status-poller";

export const metadata: Metadata = {
  title: "Order confirmation — Medivi Shop",
};

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(db, id);
  if (!order) notFound();

  const isPaid = order.status === "paid" || order.status === "fulfilled" || order.status === "refunded";
  const isFailed = order.status === "pending" && order.latestPaymentStatus === "failed";
  const isProcessing = order.status === "pending" && !isFailed;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {isProcessing && <OrderStatusPoller />}

      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        {isPaid && (
          <>
            <p className="font-display text-3xl">Thank you for your order!</p>
            <p className="text-muted-foreground">A confirmation has been recorded for order {order.orderNumber}.</p>
          </>
        )}
        {isFailed && (
          <>
            <p className="font-display text-3xl">Payment failed</p>
            <p className="text-muted-foreground">
              Order {order.orderNumber} was not charged. Your cart is unchanged — you can try again.
            </p>
            <Button asChild className="mt-2">
              <Link href="/checkout">Try again</Link>
            </Button>
          </>
        )}
        {isProcessing && (
          <>
            <p className="font-display text-3xl">Payment processing</p>
            <p className="text-muted-foreground">
              We&apos;re confirming payment for order {order.orderNumber}. This page will update automatically.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border p-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Order number</span>
          <span className="font-medium">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium capitalize">{order.status}</span>
        </div>

        <ul className="flex flex-col gap-2 border-t pt-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.nameSnapshot}
                {item.variantLabelSnapshot ? ` — ${item.variantLabelSnapshot}` : ""} × {item.quantity}
              </span>
              <span>{formatPriceCents(item.lineTotalCents, order.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatPriceCents(order.subtotalCents, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{formatPriceCents(order.shippingCents, order.currency)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span className="font-display text-lg">{formatPriceCents(order.totalCents, order.currency)}</span>
          </div>
        </div>

        <div className="border-t pt-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Shipping to</p>
          <p>{order.shippingAddress.fullName}</p>
          <p>{order.shippingAddress.line1}</p>
          {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
          <p>
            {order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}
          </p>
          <p>{order.shippingAddress.country}</p>
        </div>
      </div>
    </div>
  );
}
