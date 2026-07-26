import "server-only";
import { db } from "@medivi/db/client";
import { getOrderById } from "@medivi/db/queries";
import { renderOrderConfirmationEmail } from "@medivi/email";
import { getEmailProvider } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Best-effort, outside the fulfillment transaction (see docs/architecture.md
 * §4) — a failed send is logged, never surfaced to the webhook/mock-approval
 * caller, since Stripe's retry behavior must depend only on whether the
 * order was actually fulfilled, not on email delivery.
 */
export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  try {
    const order = await getOrderById(db, orderId);
    if (!order || !order.recipientEmail) return;

    const { subject, html } = await renderOrderConfirmationEmail({
      orderNumber: order.orderNumber,
      items: order.items,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      currency: order.currency,
      orderUrl: new URL(`/order/confirmation/${order.id}`, env.NEXT_PUBLIC_APP_URL).toString(),
    });

    await getEmailProvider().send({ to: order.recipientEmail, subject, html });
  } catch (err) {
    console.error("Failed to send order confirmation email", err);
  }
}
