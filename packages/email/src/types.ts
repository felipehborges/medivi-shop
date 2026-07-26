export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * `ResendProvider` (real) / `ConsoleEmailProvider` (dev/test — logs the
 * rendered email instead of sending) — same shape as `PaymentProvider` and
 * `StorageProvider`. Templates render to a subject/html pair *before*
 * reaching a provider, so the provider never sees template logic, only a
 * rendered payload (see docs/architecture.md §6).
 */
export interface EmailProvider {
  send(input: SendEmailInput): Promise<void>;
}
