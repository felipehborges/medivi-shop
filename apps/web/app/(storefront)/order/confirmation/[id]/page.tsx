import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getOrderById } from "@medivi/db/queries";
import { Button } from "@medivi/ui/components/ui/button";
import { OrderDetailCard } from "@/components/order-detail-card";
import { OrderStatusPoller } from "@/components/order-status-poller";
import { CheckoutCompletedBeacon } from "@/components/checkout-completed-beacon";

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
      {isPaid && <CheckoutCompletedBeacon orderId={order.id} />}

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

      <OrderDetailCard order={order} />
    </div>
  );
}
