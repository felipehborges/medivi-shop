"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@medivi/db/client";
import { fulfillPaidOrder, getOrderById, recordPaymentFailure } from "@medivi/db/queries";
import { env } from "@/lib/env";
import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";
import { logger } from "@/lib/logger";

const mockActionSchema = z.object({
  orderId: z.string().uuid(),
  redirectPath: z.string().regex(/^\/(?![\\/])/, "Redirect must be a same-origin path"),
});

function requireMockProvider() {
  if (env.PAYMENT_PROVIDER !== "mock") {
    throw new Error("Mock checkout is disabled");
  }
}

/**
 * Calls the exact same fulfillment function the Stripe webhook route calls
 * (`fulfillPaidOrder`) — the mock provider's "approve" is a stand-in for a
 * real webhook delivery, not a separate code path (see docs/architecture.md §5).
 */
export async function approveMockPayment(input: z.infer<typeof mockActionSchema>) {
  requireMockProvider();
  const { orderId, redirectPath } = mockActionSchema.parse(input);
  const order = await getOrderById(db, orderId);
  if (order && order.status === "pending") {
    const outcome = await fulfillPaidOrder(db, {
      eventId: `mock_${orderId}_approved`,
      provider: "mock",
      orderId,
      providerRef: `mock_${orderId}`,
    });
    logger.info({ orderId, outcome: outcome.outcome }, "Mock payment approved");
    if (outcome.outcome === "paid") await sendOrderConfirmationEmail(orderId);
    revalidatePath("/", "layout");
  }
  redirect(redirectPath);
}

export async function declineMockPayment(input: z.infer<typeof mockActionSchema>) {
  requireMockProvider();
  const { orderId, redirectPath } = mockActionSchema.parse(input);
  const order = await getOrderById(db, orderId);
  if (order && order.status === "pending") {
    await recordPaymentFailure(db, {
      eventId: `mock_${orderId}_declined`,
      provider: "mock",
      orderId,
    });
  }
  redirect(redirectPath);
}
