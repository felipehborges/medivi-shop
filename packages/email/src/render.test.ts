import { describe, expect, it } from "vitest";

import {
  renderOrderConfirmationEmail,
  renderResetPasswordEmail,
  renderVerifyEmailEmail,
  renderWelcomeEmail,
} from "./render";

/**
 * Asserts on specific dynamic content rather than a full-HTML snapshot —
 * a rendered-markup snapshot breaks on any incidental styling change and
 * tells you nothing about whether the email is actually correct, whereas
 * these substring checks catch the failure mode that actually matters: a
 * template silently dropping a name/link/amount.
 */
describe("renderOrderConfirmationEmail", () => {
  it("includes the order number, line items, totals, and a working link", async () => {
    const { subject, html } = await renderOrderConfirmationEmail({
      orderNumber: "MDV-20260101-ABCD1234",
      items: [{ nameSnapshot: "Iron Sword", variantLabelSnapshot: "Standard", quantity: 2, lineTotalCents: 2000 }],
      subtotalCents: 2000,
      shippingCents: 500,
      totalCents: 2500,
      currency: "USD",
      orderUrl: "https://example.com/order/confirmation/abc-123",
    });

    expect(subject).toContain("MDV-20260101-ABCD1234");
    expect(html).toContain("MDV-20260101-ABCD1234");
    expect(html).toContain("Iron Sword");
    expect(html).toContain("Standard");
    expect(html).toContain("$25.00");
    expect(html).toContain("https://example.com/order/confirmation/abc-123");
  });
});

describe("renderWelcomeEmail", () => {
  it("greets the user by name and links to the shop", async () => {
    const { subject, html } = await renderWelcomeEmail({ name: "Ada", shopUrl: "https://example.com" });
    expect(subject).toBe("Welcome to Medivi Shop");
    expect(html).toContain("Ada");
    expect(html).toContain("https://example.com");
  });
});

describe("renderVerifyEmailEmail", () => {
  it("includes the verification link", async () => {
    const { subject, html } = await renderVerifyEmailEmail({
      name: "Ada",
      verifyUrl: "https://example.com/verify?token=abc",
    });
    expect(subject).toBe("Verify your email address");
    expect(html).toContain("https://example.com/verify?token=abc");
  });
});

describe("renderResetPasswordEmail", () => {
  it("includes the reset link", async () => {
    const { subject, html } = await renderResetPasswordEmail({
      name: "Ada",
      resetUrl: "https://example.com/reset-password?token=xyz",
    });
    expect(subject).toBe("Reset your password");
    expect(html).toContain("https://example.com/reset-password?token=xyz");
  });
});
