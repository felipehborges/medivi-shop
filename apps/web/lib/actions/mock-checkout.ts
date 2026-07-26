"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@medivi/db/client";
import { fulfillPaidOrder, getOrderById, recordPaymentFailure } from "@medivi/db/queries";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";

const mockActionSchema = z.object({
  orderId: z.string().uuid(),
  redirectUrl: z.string().url(),
});

/**
 * Calls the exact same fulfillment function the Stripe webhook route calls
 * (`fulfillPaidOrder`) — the mock provider's "approve" is a stand-in for a
 * real webhook delivery, not a separate code path (see docs/architecture.md §5).
 */
export async function approveMockPayment(input: z.infer<typeof mockActionSchema>) {
  const { orderId, redirectUrl } = mockActionSchema.parse(input);
  const order = await getOrderById(db, orderId);
  if (order && order.status === "pending") {
    const outcome = await fulfillPaidOrder(db, {
      eventId: `mock_${orderId}_approved`,
      provider: "mock",
      orderId,
      providerRef: `mock_${orderId}`,
    });
    if (outcome.outcome === "paid") await sendOrderConfirmationEmail(orderId);
    revalidatePath("/", "layout");
  }
  redirect(redirectUrl);
}

export async function declineMockPayment(input: z.infer<typeof mockActionSchema>) {
  const { orderId, redirectUrl } = mockActionSchema.parse(input);
  const order = await getOrderById(db, orderId);
  if (order && order.status === "pending") {
    await recordPaymentFailure(db, {
      eventId: `mock_${orderId}_declined`,
      provider: "mock",
      orderId,
    });
  }
  redirect(redirectUrl);
}
