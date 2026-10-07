import { ConsoleSender } from "@/lib/email/console-sender";
import { ResendSender } from "@/lib/email/resend-sender";

export type EmailMessage = { to: string; subject: string; html: string; text: string; idempotencyKey: string };
export type SendResult = { ok: true; providerId: string | null } | { ok: false; error: string };

export interface EmailSender {
  readonly transport: "resend" | "console";
  /** Never throws: a failure is a `{ ok: false }` value so one bad recipient cannot stop a batch. */
  send(message: EmailMessage): Promise<SendResult>;
}

export class EmailConfigError extends Error {}

export function createEmailSender(env: Record<string, string | undefined> = process.env): EmailSender {
  const transport = env.EMAIL_TRANSPORT || undefined;
  if (transport !== undefined && transport !== "resend" && transport !== "console") {
    throw new EmailConfigError('EMAIL_TRANSPORT must be "resend" or "console".');
  }
  const production = env.NODE_ENV === "production";
  if (transport === "console" && production) throw new EmailConfigError("EMAIL_TRANSPORT=console is not allowed in production.");

  if (transport === "console" || (transport === undefined && !env.RESEND_API_KEY && !production)) return new ConsoleSender();
  if (!env.RESEND_API_KEY) throw new EmailConfigError("RESEND_API_KEY is not set.");
  if (!env.EMAIL_FROM) throw new EmailConfigError("EMAIL_FROM is not set.");
  return new ResendSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
}
