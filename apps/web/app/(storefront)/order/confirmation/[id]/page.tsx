import { LocalizedText } from "@/components/localized-text";
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
            <p className="font-display text-3xl"><LocalizedText text={"Thank you for your order!"} /></p>
            <p className="text-muted-foreground"><LocalizedText text={"A confirmation has been recorded for order "} />{order.orderNumber}.</p>
          </>
        )}
        {isFailed && (
          <>
            <p className="font-display text-3xl"><LocalizedText text={"Payment failed"} /></p>
            <p className="text-muted-foreground">
              <LocalizedText text={"Order "} />{order.orderNumber} <LocalizedText text={"was not charged. Your cart is unchanged — you can try again. "} /></p>
            <Button asChild className="mt-2">
              <Link href="/checkout"><LocalizedText text={"Try again"} /></Link>
            </Button>
          </>
        )}
        {isProcessing && (
          <>
            <p className="font-display text-3xl"><LocalizedText text={"Payment processing"} /></p>
            <p className="text-muted-foreground">
              <LocalizedText text={"We're confirming payment for order "} />{order.orderNumber}<LocalizedText text={". This page will update automatically. "} /></p>
          </>
        )}
      </div>

      <OrderDetailCard order={order} />
    </div>
  );
}
