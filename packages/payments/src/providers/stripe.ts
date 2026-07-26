import Stripe from "stripe";

import type {
  CheckoutSessionResult,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
  RefundResult,
  VerifiedWebhook,
} from "../types";

export type StripeProviderConfig = {
  secretKey: string;
  webhookSecret: string;
};

export class StripeProvider implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: StripeProviderConfig) {
    this.stripe = new Stripe(config.secretKey);
    this.webhookSecret = config.webhookSecret;
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.customerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { orderId: input.orderId },
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountCents,
            product_data: { name: `Medivi Shop order ${input.orderNumber}` },
          },
          quantity: 1,
        },
      ],
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }
    return { url: session.url, providerSessionId: session.id };
  }

  /**
   * Throws on a bad/missing signature — callers turn that into a clean 4xx
   * (see docs/architecture.md §9), never a silently-processed event.
   */
  verifyAndParseWebhook(rawBody: string, signature: string | null): VerifiedWebhook {
    if (!signature) {
      throw new Error("Missing Stripe-Signature header");
    }
    const stripeEvent = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    return { eventId: stripeEvent.id, event: toPaymentEvent(stripeEvent) };
  }

  async refund(providerRef: string, amountCents?: number): Promise<RefundResult> {
    try {
      await this.stripe.refunds.create({
        payment_intent: providerRef,
        ...(amountCents !== undefined ? { amount: amountCents } : {}),
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "Unknown Stripe error" };
    }
  }
}

function toPaymentEvent(stripeEvent: Stripe.Event): PaymentEvent {
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const orderId = session.metadata?.orderId;
    if (!orderId) return { type: "unhandled" };
    return {
      type: "checkout_completed",
      orderId,
      // The checkout session's payment_intent is the reference refunds need
      // later; falls back to the session id only if Stripe omits it.
      providerRef: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
      amountCents: session.amount_total ?? 0,
    };
  }

  if (stripeEvent.type === "checkout.session.expired") {
    const session = stripeEvent.data.object;
    const orderId = session.metadata?.orderId;
    if (!orderId) return { type: "unhandled" };
    return { type: "checkout_failed", orderId, providerRef: session.id };
  }

  return { type: "unhandled" };
}
