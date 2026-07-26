export type CreateCheckoutInput = {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSessionResult = {
  url: string;
  providerSessionId: string;
};

export type PaymentEvent =
  | { type: "checkout_completed"; orderId: string; providerRef: string; amountCents: number }
  | { type: "checkout_failed"; orderId: string; providerRef: string }
  | { type: "unhandled" };

export type VerifiedWebhook = {
  eventId: string;
  event: PaymentEvent;
};

export type RefundResult = { ok: true } | { ok: false; reason: string };

/**
 * `createOrder`/webhook handler shape is identical regardless of provider —
 * see docs/architecture.md §5. `verifyAndParseWebhook` throws on a bad
 * signature so callers can turn that into a clean 4xx without special-casing.
 */
export interface PaymentProvider {
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult>;
  verifyAndParseWebhook(rawBody: string, signature: string | null): VerifiedWebhook;
  refund(providerRef: string, amountCents?: number): Promise<RefundResult>;
}
