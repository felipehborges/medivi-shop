import type { EmailProvider, SendEmailInput } from "../types";

/** Logs the fully-rendered email instead of sending it — the default in local dev/test/CI. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<void> {
    console.log(
      [
        "\n--- ConsoleEmailProvider ---",
        `To: ${input.to}`,
        `Subject: ${input.subject}`,
        "",
        input.html,
        "--- end email ---\n",
      ].join("\n"),
    );
  }
}
