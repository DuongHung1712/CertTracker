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
  claimedAt: number;
  providerId?: string | null;
  error?: string;
};

/** Same window as the 15-minute interval in `claim_notification`. */
export const STALE_CLAIM_MS = 15 * 60_000;

/**
 * In-memory ledger mirroring `claim_notification`: the first claim wins; a `failed` row, or a `pending` row older
 * than 15 minutes, is re-claimed (attempts + 1); a fresh `pending` row is in-flight and a `sent` row is sent.
 * Time is the injectable `nowMs` (advance it with `advance`), never the system clock.
 */
export class FakeLedger implements NotificationLedger {
  nowMs = 0;
  rows = new Map<string, FakeRow>();
  calls = { claim: 0, markSent: 0, markFailed: 0 };
  claimThrowsFor = new Set<string>();
  /** Remaining number of `markSent` calls that throw, per email (use `Infinity` for always). */
  markSentThrowsFor = new Map<string, number>();
  markFailedThrows = false;
  /** `markSent` reports a lost claim (returns false) for these emails. */
  markSentLostFor = new Set<string>();
  private seq = 0;

  async claim(kind: NotificationKind, period: string, email: string): Promise<ClaimResult> {
    this.calls.claim += 1;
    if (this.claimThrowsFor.has(email)) throw new Error("db down");
    const key = `${kind}|${period}|${email}`;
    const existing = this.rows.get(key);
    if (existing) {
      const stale = existing.status === "pending" && existing.claimedAt < this.nowMs - STALE_CLAIM_MS;
      if (existing.status !== "failed" && !stale) {
        return { claimed: false, reason: existing.status === "sent" ? "sent" : "in-flight" };
      }
      existing.status = "pending";
      existing.attempts += 1;
      existing.claimedAt = this.nowMs;
      delete existing.error;
      return { claimed: true, id: existing.id, attempt: existing.attempts };
    }
    this.seq += 1;
    const row: FakeRow = { id: `log-${this.seq}`, kind, period, email, status: "pending", attempts: 1, claimedAt: this.nowMs };
    this.rows.set(key, row);
    return { claimed: true, id: row.id, attempt: row.attempts };
  }

  advance(ms: number): void {
    this.nowMs += ms;
  }

  /** Puts a row in place as if another worker had claimed it `agoMs` ago. */
  seedPending(kind: NotificationKind, period: string, email: string, agoMs = 0): void {
    this.seq += 1;
    this.rows.set(`${kind}|${period}|${email}`, {
      id: `log-${this.seq}`,
      kind,
      period,
      email,
      status: "pending",
      attempts: 1,
      claimedAt: this.nowMs - agoMs,
    });
  }

  private find(id: string): FakeRow | undefined {
    return [...this.rows.values()].find((r) => r.id === id);
  }

  async markSent(id: string, attempt: number, providerId: string | null): Promise<boolean> {
    this.calls.markSent += 1;
    const row = this.find(id);
    const throwsLeft = row ? (this.markSentThrowsFor.get(row.email) ?? 0) : 0;
    if (row && throwsLeft > 0) {
      this.markSentThrowsFor.set(row.email, throwsLeft - 1);
      throw new Error("db down");
    }
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
