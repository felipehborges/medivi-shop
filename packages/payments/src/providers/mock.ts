import type {
  CheckoutSessionResult,
  CreateCheckoutInput,
  PaymentProvider,
  RefundResult,
  VerifiedWebhook,
} from "../types";

/**
 * No network calls. `createCheckoutSession` points at an internal
 * approve/decline page (`/checkout/mock/[orderId]`) instead of an external
 * processor — the order id doubles as the token since it's already an
 * unguessable uuid and this path only ever runs with `PAYMENT_PROVIDER=mock`
 * (local dev / CI / demos), not a real-money flow. The approve/decline page
 * calls the same fulfillment function the Stripe webhook route calls, so
 * the code path is identical either way (see docs/architecture.md §5).
 */
export class MockProvider implements PaymentProvider {
  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSessionResult> {
    const origin = new URL(input.successUrl).origin;
    const url = new URL(`/checkout/mock/${input.orderId}`, origin);
    url.searchParams.set("successUrl", input.successUrl);
    url.searchParams.set("cancelUrl", input.cancelUrl);
    return { url: url.toString(), providerSessionId: `mock_${input.orderId}` };
  }

  verifyAndParseWebhook(_rawBody: string, _signature: string | null): VerifiedWebhook {
    throw new Error(
      "MockProvider has no webhook — its approve/decline actions call the fulfillment function directly.",
    );
  }

  async refund(_providerRef: string, _amountCents?: number): Promise<RefundResult> {
    return { ok: true };
  }
}
