"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@medivi/db/client";
import { createOrder, createPayment, getCart, type StockOrPriceIssue } from "@medivi/db/queries";
import { getSession } from "@/lib/auth-guards";
import { resolveOwnerForRead } from "@/lib/cart-owner";
import { env } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { getCheckoutRateLimiter } from "@/lib/rate-limit";
import { checkoutSchema, type CheckoutInput } from "@/lib/schemas/checkout";
import { getShippingMethod } from "@/lib/shipping";

export type CheckoutActionResult =
  | { ok: false; reason: "guest_email_required" }
  | { ok: false; reason: "empty_cart" }
  | { ok: false; reason: "rate_limited" }
  | { ok: false; reason: "stock_or_price_changed"; issues: StockOrPriceIssue[] };

async function getClientIdentifier(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Never sets order/payment status itself — it only creates the `pending`
 * order and hands off to the payment provider. Only the webhook (or the
 * mock provider's equivalent) is allowed to mark a payment `paid` (see
 * CLAUDE.md's non-negotiable payment rule).
 */
export async function checkoutAction(input: CheckoutInput): Promise<CheckoutActionResult> {
  const parsed = checkoutSchema.parse(input);

  const identifier = await getClientIdentifier();
  const rateLimit = await getCheckoutRateLimiter().limit(identifier);
  if (!rateLimit.success) return { ok: false, reason: "rate_limited" };

  const session = await getSession();
  if (!session && !parsed.guestEmail) {
    return { ok: false, reason: "guest_email_required" };
  }

  const owner = await resolveOwnerForRead();
  const cartRow = owner ? await getCart(db, owner) : null;
  if (!cartRow) return { ok: false, reason: "empty_cart" };

  const shippingMethod = getShippingMethod(parsed.shippingMethodId);
  const result = await createOrder(
    db,
    cartRow.id,
    session ? { userId: session.user.id } : { guestEmail: parsed.guestEmail! },
    { shippingAddress: parsed.shippingAddress, shippingCents: shippingMethod.cents },
  );
  if (!result.ok) return result;

  const provider = getPaymentProvider();
  const customerEmail = session?.user.email ?? parsed.guestEmail!;
  const { url, providerSessionId } = await provider.createCheckoutSession({
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    amountCents: result.totalCents,
    currency: "USD",
    customerEmail,
    successUrl: `${env.NEXT_PUBLIC_APP_URL}/order/confirmation/${result.orderId}`,
    cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/checkout`,
  });

  await createPayment(db, {
    orderId: result.orderId,
    provider: env.PAYMENT_PROVIDER,
    providerRef: providerSessionId,
    amountCents: result.totalCents,
  });

  redirect(url);
}
