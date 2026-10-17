import { Resend } from "resend";
import type { EmailMessage, EmailSender, SendResult } from "@/lib/email/sender";

type ResendLike = {
  emails: {
    send(
      payload: { from: string; to: string[]; subject: string; html: string; text: string },
      options?: { idempotencyKey?: string },
    ): Promise<{ data: { id: string } | null; error: { name: string; message: string } | null }>;
  };
};

export class ResendSender implements EmailSender {
  readonly transport = "resend" as const;
  private readonly client: ResendLike;
  private readonly from: string;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastSentAt = Number.NEGATIVE_INFINITY;

  constructor(options: {
    apiKey: string;
    from: string;
    /** Resend's free plan allows 2 requests per second. */
    minIntervalMs?: number;
    client?: ResendLike;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  }) {
    // No cast: the installed SDK is assignable to ResendLike, so tsc fails here if a Resend upgrade changes `emails.send`.
    this.client = options.client ?? new Resend(options.apiKey);
    this.from = options.from;
    this.minIntervalMs = options.minIntervalMs ?? 600;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const wait = this.lastSentAt + this.minIntervalMs - this.now();
      if (this.minIntervalMs > 0 && wait > 0) await this.sleep(wait);
      this.lastSentAt = this.now();
      const { data, error } = await this.client.emails.send(
        {
          from: this.from,
          to: [message.to],
          // A subject built from data must never carry a line break (header injection).
          subject: message.subject.replace(/[\r\n]+/g, " "),
          html: message.html,
          text: message.text,
        },
        { idempotencyKey: message.idempotencyKey },
      );
      if (error) return { ok: false, error: `${error.name}: ${error.message}` };
      return { ok: true, providerId: data?.id ?? null };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
