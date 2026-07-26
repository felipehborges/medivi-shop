import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getOrderById } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";
import { MockCheckoutActions } from "@/components/mock-checkout-actions";

export const metadata: Metadata = {
  title: "Mock Payment — Medivi Shop",
};

export default async function MockCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ successUrl?: string; cancelUrl?: string }>;
}) {
  const { token: orderId } = await params;
  const { successUrl, cancelUrl } = await searchParams;
  const order = await getOrderById(db, orderId);
  if (!order || !successUrl || !cancelUrl) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="rounded-xl border-2 border-dashed p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mock payment processor
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          No real payment provider is configured — this stands in for a Stripe-hosted checkout page.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border p-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Order</span>
          <span className="font-medium">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-display text-lg">{formatPriceCents(order.totalCents, order.currency)}</span>
        </div>
      </div>

      {order.status === "pending" ? (
        <MockCheckoutActions orderId={order.id} successUrl={successUrl} cancelUrl={cancelUrl} />
      ) : (
        <p className="text-sm text-muted-foreground">
          This order has already been processed.{" "}
          <Link href={successUrl} className="underline">
            Continue
          </Link>
        </p>
      )}
    </div>
  );
}
