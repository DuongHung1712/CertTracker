import type { EmailMessage, EmailSender, SendResult } from "@/lib/email/sender";

/** Development/e2e transport: nothing leaves the machine. Logs the recipient and subject only, never the body. */
export class ConsoleSender implements EmailSender {
  readonly transport = "console" as const;
  async send(message: EmailMessage): Promise<SendResult> {
    console.info(`[email:console] to=${message.to} subject=${JSON.stringify(message.subject.replace(/[\r\n]+/g, " "))}`);
    return { ok: true, providerId: `console:${message.idempotencyKey}` };
  }
}
