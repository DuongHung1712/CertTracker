import type { RenderedEmail } from "@/features/notifications/emails";
import type { ClaimResult, NotificationLedger } from "@/features/notifications/ledger";
import type { NotificationKind } from "@/features/notifications/types";
import type { EmailSender, SendResult } from "@/lib/email/sender";

export type Outbound = { email: string; detail: Record<string, number>; render: () => Promise<RenderedEmail> };

export type DeliverResult = {
  planned: number;
  sent: number;
  skipped: number;
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
      result.skipped += 1;
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
      const held = await ledger.markSent(claim.id, claim.attempt, outcome.providerId);
      if (!held) result.warnings.push(`${o.email}: claim lost before it was recorded as sent`);
      result.sent += 1;
    } catch (e) {
      // The mail went out but the log still says pending: the next call reclaims it after 15 minutes and
      // Resend's idempotency key keeps that retry from delivering a second copy.
      fail(o.email, `sent but could not be recorded: ${message(e)}`);
    }
  }
  return result;
}
