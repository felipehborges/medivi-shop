import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getLatestPaymentForOrder, getOrderById } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";
import { MockCheckoutActions } from "@/components/mock-checkout-actions";
import { env } from "@/lib/env";

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
  if (env.PAYMENT_PROVIDER !== "mock") notFound();

  const { token: orderId } = await params;
  const { successUrl, cancelUrl } = await searchParams;
  const [order, latestPayment] = await Promise.all([getOrderById(db, orderId), getLatestPaymentForOrder(db, orderId)]);
  if (!order || !successUrl || !cancelUrl || latestPayment?.provider !== "mock") notFound();

  const appOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin;
  const redirectPath = (url: string) => {
    const parsed = new URL(url);
    if (parsed.origin !== appOrigin) notFound();
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  };
  const successPath = redirectPath(successUrl);
  const cancelPath = redirectPath(cancelUrl);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="rounded-xl border-2 border-dashed p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <LocalizedText text={"Mock payment processor "} /></p>
        <p className="mt-1 text-sm text-muted-foreground">
          <LocalizedText text={"No real payment provider is configured — this stands in for a Stripe-hosted checkout page. "} /></p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border p-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground"><LocalizedText text={"Order"} /></span>
          <span className="font-medium">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground"><LocalizedText text={"Amount"} /></span>
          <span className="font-display text-lg">{formatPriceCents(order.totalCents, order.currency)}</span>
        </div>
      </div>

      {order.status === "pending" ? (
        <MockCheckoutActions orderId={order.id} successPath={successPath} cancelPath={cancelPath} />
      ) : (
        <p className="text-sm text-muted-foreground">
          <LocalizedText text={"This order has already been processed."} />{" "}
          <Link href={successPath} className="underline">
            <LocalizedText text={"Continue "} /></Link>
        </p>
      )}
    </div>
  );
}
