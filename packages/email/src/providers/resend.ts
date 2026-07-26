import { Resend } from "resend";

import type { EmailProvider, SendEmailInput } from "../types";

export type ResendProviderConfig = {
  apiKey: string;
  from: string;
};

export class ResendProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(config: ResendProviderConfig) {
    this.client = new Resend(config.apiKey);
    this.from = config.from;
  }

  async send(input: SendEmailInput): Promise<void> {
    const result = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (result.error) {
      throw new Error(`Resend send failed: ${result.error.message}`);
    }
  }
}
