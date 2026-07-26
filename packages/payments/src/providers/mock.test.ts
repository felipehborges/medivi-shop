import { describe, expect, it } from "vitest";

import { MockProvider } from "./mock";

describe("MockProvider", () => {
  it("builds an internal checkout URL carrying the order id and redirect targets", async () => {
    const provider = new MockProvider();
    const result = await provider.createCheckoutSession({
      orderId: "11111111-1111-1111-1111-111111111111",
      orderNumber: "MDV-TEST",
      amountCents: 2599,
      currency: "USD",
      customerEmail: "adventurer@example.com",
      successUrl: "http://localhost:3000/order/confirmation/11111111-1111-1111-1111-111111111111",
      cancelUrl: "http://localhost:3000/checkout",
    });

    const url = new URL(result.url);
    expect(url.pathname).toBe("/checkout/mock/11111111-1111-1111-1111-111111111111");
    expect(url.searchParams.get("successUrl")).toBe(
      "http://localhost:3000/order/confirmation/11111111-1111-1111-1111-111111111111",
    );
    expect(url.searchParams.get("cancelUrl")).toBe("http://localhost:3000/checkout");
    expect(result.providerSessionId).toBe("mock_11111111-1111-1111-1111-111111111111");
  });

  it("refund always succeeds (no real money moved)", async () => {
    const provider = new MockProvider();
    await expect(provider.refund("mock_anything")).resolves.toEqual({ ok: true });
  });

  it("has no webhook path", () => {
    const provider = new MockProvider();
    expect(() => provider.verifyAndParseWebhook("{}", "sig")).toThrow();
  });
});
