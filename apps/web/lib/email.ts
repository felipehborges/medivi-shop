import "server-only";
import { ConsoleEmailProvider, ResendProvider, type EmailProvider } from "@medivi/email";
import { env } from "./env";

let cached: EmailProvider | null = null;

/** Selected by `EMAIL_PROVIDER`, never inferred from `NODE_ENV` (same pattern as payments/storage). */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    }
    cached = new ResendProvider({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  } else {
    cached = new ConsoleEmailProvider();
  }
  return cached;
}
