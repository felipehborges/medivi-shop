import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { StripeProvider } from "./stripe";

const webhookSecret = "whsec_test_secret";

function signedRequest(payload: object) {
  const rawBody = JSON.stringify(payload);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret: webhookSecret });
  return { rawBody, signature };
}

describe("StripeProvider.verifyAndParseWebhook", () => {
  const provider = new StripeProvider({ secretKey: "sk_test_dummy", webhookSecret });

  it("rejects a tampered signature", () => {
    const { rawBody } = signedRequest({ id: "evt_1", type: "checkout.session.completed" });
    expect(() => provider.verifyAndParseWebhook(rawBody, "t=1,v1=not-a-real-signature")).toThrow();
  });

  it("rejects a missing signature", () => {
    const { rawBody } = signedRequest({ id: "evt_1", type: "checkout.session.completed" });
    expect(() => provider.verifyAndParseWebhook(rawBody, null)).toThrow();
  });

  it("parses checkout.session.completed into a checkout_completed event", () => {
    const { rawBody, signature } = signedRequest({
      id: "evt_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          payment_intent: "pi_test_123",
          amount_total: 4599,
          metadata: { orderId: "order-uuid-1" },
        },
      },
    });

    const result = provider.verifyAndParseWebhook(rawBody, signature);
    expect(result.eventId).toBe("evt_completed");
    expect(result.event).toEqual({
      type: "checkout_completed",
      orderId: "order-uuid-1",
      providerRef: "pi_test_123",
      amountCents: 4599,
    });
  });

  it("parses checkout.session.expired into a checkout_failed event", () => {
    const { rawBody, signature } = signedRequest({
      id: "evt_expired",
      type: "checkout.session.expired",
      data: {
        object: { id: "cs_test_456", metadata: { orderId: "order-uuid-2" } },
      },
    });

    const result = provider.verifyAndParseWebhook(rawBody, signature);
    expect(result.event).toEqual({ type: "checkout_failed", orderId: "order-uuid-2", providerRef: "cs_test_456" });
  });

  it("treats an unrelated event type as unhandled", () => {
    const { rawBody, signature } = signedRequest({ id: "evt_other", type: "payment_intent.created", data: { object: {} } });
    const result = provider.verifyAndParseWebhook(rawBody, signature);
    expect(result.event).toEqual({ type: "unhandled" });
  });

  it("treats checkout.session.completed with no orderId metadata as unhandled", () => {
    const { rawBody, signature } = signedRequest({
      id: "evt_no_metadata",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_789", metadata: {} } },
    });
    const result = provider.verifyAndParseWebhook(rawBody, signature);
    expect(result.event).toEqual({ type: "unhandled" });
  });
});
