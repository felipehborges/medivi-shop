import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { db } from "@medivi/db/client";
import { fulfillPaidOrder, recordPaymentFailure } from "@medivi/db/queries";
import type { PaymentEvent } from "@medivi/payments";
import { getPaymentProvider } from "@/lib/payments";

/**
 * The one route-level exception to "let it throw" (see docs/plan.md §20):
 * malformed/unverifiable payloads are logged and rejected with a clean 4xx
 * instead of crashing, because Stripe's retry behavior depends on the
 * response code.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let eventId: string;
  let event: PaymentEvent;
  try {
    ({ eventId, event } = getPaymentProvider().verifyAndParseWebhook(rawBody, signature));
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout_completed") {
    await fulfillPaidOrder(db, {
      eventId,
      provider: "stripe",
      orderId: event.orderId,
      providerRef: event.providerRef,
    });
    revalidatePath("/", "layout");
  } else if (event.type === "checkout_failed") {
    await recordPaymentFailure(db, { eventId, provider: "stripe", orderId: event.orderId });
  }
  // Unknown/irrelevant event types are acknowledged and ignored, never crash the handler.

  return NextResponse.json({ received: true });
}
