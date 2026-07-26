import "server-only";
import { MockProvider, StripeProvider, type PaymentProvider } from "@medivi/payments";
import { env } from "./env";

let cached: PaymentProvider | null = null;

/** Selected by `PAYMENT_PROVIDER`, never inferred from `NODE_ENV` (see docs/plan.md §8). */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  if (env.PAYMENT_PROVIDER === "stripe") {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required when PAYMENT_PROVIDER=stripe");
    }
    cached = new StripeProvider({ secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET });
  } else {
    cached = new MockProvider();
  }
  return cached;
}
