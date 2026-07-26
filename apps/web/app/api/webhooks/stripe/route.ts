import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@medivi/db/client";
import { fulfillPaidOrder, recordPaymentFailure } from "@medivi/db/queries";
import type { PaymentEvent } from "@medivi/payments";
import { getPaymentProvider } from "@/lib/payments";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { logger } from "@/lib/logger";
import { getWebhookRateLimiter } from "@/lib/rate-limit";

/**
 * The one route-level exception to "let it throw" (see docs/plan.md §20):
 * malformed/unverifiable payloads are logged and rejected with a clean 4xx
 * instead of crashing, because Stripe's retry behavior depends on the
 * response code.
 */
export async function POST(request: Request) {
  const identifier = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await getWebhookRateLimiter().limit(identifier);
  if (!rateLimit.success) {
    logger.warn({ identifier }, "Stripe webhook rate limit exceeded");
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let eventId: string;
  let event: PaymentEvent;
  try {
    ({ eventId, event } = getPaymentProvider().verifyAndParseWebhook(rawBody, signature));
  } catch (err) {
    logger.error({ err }, "Stripe webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logger.info({ eventId, eventType: event.type }, "Stripe webhook received");

  if (event.type === "checkout_completed") {
    const outcome = await fulfillPaidOrder(db, {
      eventId,
      provider: "stripe",
      orderId: event.orderId,
      providerRef: event.providerRef,
    });
    logger.info({ eventId, orderId: event.orderId, outcome: outcome.outcome }, "Checkout completed processed");
    if (outcome.outcome === "paid") await sendOrderConfirmationEmail(event.orderId);
    revalidatePath("/", "layout");
  } else if (event.type === "checkout_failed") {
    await recordPaymentFailure(db, { eventId, provider: "stripe", orderId: event.orderId });
    logger.info({ eventId, orderId: event.orderId }, "Checkout failed processed");
  }
  // Unknown/irrelevant event types are acknowledged and ignored, never crash the handler.

  return NextResponse.json({ received: true });
}
