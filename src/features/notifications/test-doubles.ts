import type { ClaimResult, NotificationLedger } from "@/features/notifications/ledger";
import type { NotificationKind } from "@/features/notifications/types";
import type { EmailMessage, EmailSender, SendResult } from "@/lib/email/sender";

export type FakeRow = {
  id: string;
  kind: NotificationKind;
  period: string;
  email: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  providerId?: string | null;
  error?: string;
};

/** In-memory ledger mirroring `claim_notification`: the first claim wins, later ones see in-flight/sent. */
export class FakeLedger implements NotificationLedger {
  rows = new Map<string, FakeRow>();
  calls = { claim: 0, markSent: 0, markFailed: 0 };
  claimThrowsFor = new Set<string>();
  markSentThrowsFor = new Set<string>();
  markFailedThrows = false;
  /** `markSent` reports a lost claim (returns false) for these emails. */
  markSentLostFor = new Set<string>();
  private seq = 0;

  async claim(kind: NotificationKind, period: string, email: string): Promise<ClaimResult> {
    this.calls.claim += 1;
    if (this.claimThrowsFor.has(email)) throw new Error("db down");
    const key = `${kind}|${period}|${email}`;
    const existing = this.rows.get(key);
    if (existing) return { claimed: false, reason: existing.status === "sent" ? "sent" : "in-flight" };
    this.seq += 1;
    const row: FakeRow = { id: `log-${this.seq}`, kind, period, email, status: "pending", attempts: 1 };
    this.rows.set(key, row);
    return { claimed: true, id: row.id, attempt: row.attempts };
  }

  private find(id: string): FakeRow | undefined {
    return [...this.rows.values()].find((r) => r.id === id);
  }

  async markSent(id: string, attempt: number, providerId: string | null): Promise<boolean> {
    this.calls.markSent += 1;
    const row = this.find(id);
    if (row && this.markSentThrowsFor.has(row.email)) throw new Error("db down");
    if (!row || row.status !== "pending" || row.attempts !== attempt || this.markSentLostFor.has(row.email)) return false;
    row.status = "sent";
    row.providerId = providerId;
    return true;
  }

  async markFailed(id: string, attempt: number, error: string): Promise<boolean> {
    this.calls.markFailed += 1;
    if (this.markFailedThrows) throw new Error("db down");
    const row = this.find(id);
    if (!row || row.status !== "pending" || row.attempts !== attempt) return false;
    row.status = "failed";
    row.error = error;
    return true;
  }

  get all(): FakeRow[] {
    return [...this.rows.values()];
  }
}

export class FakeSender implements EmailSender {
  readonly transport: "resend" | "console";
  sent: EmailMessage[] = [];
  /** Per-recipient override; default is success. */
  outcome: (to: string) => SendResult = () => ({ ok: true, providerId: "prov-1" });

  constructor(transport: "resend" | "console" = "console") {
    this.transport = transport;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    this.sent.push(message);
    return this.outcome(message.to);
  }
}
