import type { RenderedEmail } from "@/features/notifications/emails";
import type { ClaimResult, NotificationLedger } from "@/features/notifications/ledger";
import type { NotificationKind } from "@/features/notifications/types";
import type { EmailSender, SendResult } from "@/lib/email/sender";

export type Outbound = { email: string; detail: Record<string, number>; render: () => Promise<RenderedEmail> };

/**
 * `planned = sent + skipped + inFlight + failed + (recipients not reached when `truncated`)`.
 * `skipped` is only "already sent"; `inFlight` is a claim another run still holds (a crashed run's row stays
 * pending for up to 15 minutes) and is also reported once per recipient in `warnings`.
 */
export type DeliverResult = {
  planned: number;
  sent: number;
  skipped: number;
  inFlight: number;
  failed: number;
  truncated: boolean;
  failures: { email: string; error: string }[];
  warnings: string[];
  recipients?: { email: string; detail: Record<string, number> }[];
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function deliver(args: {
  kind: NotificationKind;
  period: string;
  outbound: Outbound[];
  ledger: NotificationLedger;
  sender: EmailSender;
  dryRun: boolean;
  now: () => number;
  /** Absolute time (ms) after which no new recipient is claimed; whatever is left is picked up by the next call. */
  deadlineMs: number;
}): Promise<DeliverResult> {
  const { kind, period, outbound, ledger, sender, dryRun, now, deadlineMs } = args;
  const result: DeliverResult = {
    planned: outbound.length,
    sent: 0,
    skipped: 0,
    inFlight: 0,
    failed: 0,
    truncated: false,
    failures: [],
    warnings: [],
  };

  if (dryRun) {
    result.recipients = outbound.map((o) => ({ email: o.email, detail: o.detail }));
    return result;
  }

  const fail = (email: string, error: string) => {
    result.failed += 1;
    result.failures.push({ email, error });
  };

  // Strictly sequential on purpose: the Resend sender paces itself (2 req/s) and that pacing is only safe
  // when sends never overlap, so do not parallelise this loop.
  for (const o of outbound) {
    if (now() >= deadlineMs) {
      result.truncated = true;
      break;
    }
    let claim: ClaimResult;
    try {
      claim = await ledger.claim(kind, period, o.email);
    } catch (e) {
      fail(o.email, `claim: ${message(e)}`);
      continue;
    }
    if (!claim.claimed) {
      if (claim.reason === "sent") {
        result.skipped += 1;
      } else {
        result.inFlight += 1;
        result.warnings.push(`${o.email}: another run holds the claim; re-run after ~15 minutes if it does not finish`);
      }
      continue;
    }

    let outcome: SendResult;
    try {
      const mail = await o.render();
      outcome = await sender.send({ to: o.email, ...mail, idempotencyKey: `${kind}:${period}:${o.email}` });
    } catch (e) {
      outcome = { ok: false, error: message(e) };
    }

    if (!outcome.ok) {
      fail(o.email, outcome.error);
      try {
        await ledger.markFailed(claim.id, claim.attempt, outcome.error);
      } catch (e) {
        result.warnings.push(`${o.email}: could not record the failure (${message(e)})`);
      }
      continue;
    }
    try {
      // One retry: the mail is already out, so a transient database error should not turn it into a failure.
      let held: boolean;
      try {
        held = await ledger.markSent(claim.id, claim.attempt, outcome.providerId);
      } catch {
        held = await ledger.markSent(claim.id, claim.attempt, outcome.providerId);
      }
      if (!held) result.warnings.push(`${o.email}: claim lost before it was recorded as sent`);
      result.sent += 1;
    } catch (e) {
      // The mail went out but the log still says pending: the next call reclaims it after 15 minutes and
      // Resend's idempotency key keeps that retry from delivering a second copy. Resend only dedupes a key for
      // about 24 hours, so a re-send after that window can duplicate.
      fail(o.email, `sent but could not be recorded (a re-send after ~24 h may duplicate): ${message(e)}`);
    }
  }
  return result;
}
