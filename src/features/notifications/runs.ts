import { normalizeAppUrl } from "@/features/notifications/app-url";
import { monthLabel, weekLabel } from "@/features/notifications/period";
import type { NotificationKind } from "@/features/notifications/types";

export type LogRow = {
  kind: NotificationKind;
  period: string;
  status: "pending" | "sent" | "failed";
  sentAt: string | null;
  claimedAt: string;
  /** What the provider or the ledger said when the attempt failed. */
  error: string | null;
};

/** A `pending` claim older than this is dead: `claim_notification` hands it to the next run (decisions #36). */
export const STALE_PENDING_MS = 15 * 60_000;

export type RunRow = {
  kind: NotificationKind;
  period: string;
  /** Vietnamese label of the period, e.g. "tuần 41/2026" or "tháng 09/2026". */
  label: string;
  sent: number;
  failed: number;
  pending: number;
  /** The latest `sent_at` (or `claimed_at` when nothing was sent) of the group, as stored. */
  lastActivityAt: string;
  /** The error of the most recently claimed `failed` row of the group, if any. */
  lastError: string | null;
  /** `pending` rows claimed more than 15 minutes before `now`: a run died; calling the route again retries them. */
  stalePending: number;
};

function labelOf(kind: NotificationKind, period: string): string {
  try {
    return kind === "expiry-alert" ? weekLabel(period) : monthLabel(period);
  } catch {
    // A malformed period must not take the whole page down; show it as written.
    return period;
  }
}

/** One row per (kind, period): how many recipients are sent / failed / still pending. Newest first. `now` is epoch ms. */
export function summarizeRuns(rows: LogRow[], now: number): RunRow[] {
  const groups = new Map<string, { run: RunRow; lastMs: number; errorClaimMs: number }>();
  for (const r of rows) {
    const key = `${r.kind}|${r.period}`;
    const activityAt = r.sentAt ?? r.claimedAt;
    const activityMs = Date.parse(activityAt);
    let group = groups.get(key);
    if (!group) {
      group = {
        run: {
          kind: r.kind,
          period: r.period,
          label: labelOf(r.kind, r.period),
          sent: 0,
          failed: 0,
          pending: 0,
          lastActivityAt: activityAt,
          lastError: null,
          stalePending: 0,
        },
        lastMs: activityMs,
        errorClaimMs: Number.NEGATIVE_INFINITY,
      };
      groups.set(key, group);
    }
    group.run[r.status] += 1;
    const claimMs = Date.parse(r.claimedAt);
    if (r.status === "failed" && claimMs > group.errorClaimMs) {
      group.errorClaimMs = claimMs;
      group.run.lastError = r.error;
    }
    if (r.status === "pending" && claimMs < now - STALE_PENDING_MS) group.run.stalePending += 1;
    if (activityMs > group.lastMs) {
      group.lastMs = activityMs;
      group.run.lastActivityAt = activityAt;
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.lastMs - a.lastMs || b.run.period.localeCompare(a.run.period))
    .map((group) => group.run);
}

export type SetupCheck = {
  id: "resend-key" | "email-from" | "cron-secret" | "service-role-key" | "app-url";
  label: string;
  ok: boolean;
};

/** Which settings the e-mail jobs need are present. Booleans only: a value never leaves this function. */
export function emailSetupStatus(env: Record<string, string | undefined>): SetupCheck[] {
  return [
    { id: "resend-key", label: "RESEND_API_KEY", ok: Boolean(env.RESEND_API_KEY) },
    { id: "email-from", label: "EMAIL_FROM", ok: Boolean(env.EMAIL_FROM) },
    // Same rule as checkCronAuth: a shorter secret makes the cron routes refuse every request.
    { id: "cron-secret", label: "CRON_SECRET (từ 16 ký tự)", ok: (env.CRON_SECRET?.length ?? 0) >= 16 },
    { id: "service-role-key", label: "SUPABASE_SERVICE_ROLE_KEY", ok: Boolean(env.SUPABASE_SERVICE_ROLE_KEY) },
    // Present but unusable (not https, no scheme…) counts as not configured: the mails would go out without links.
    { id: "app-url", label: "APP_URL (https://…, dùng cho liên kết trong email)", ok: normalizeAppUrl(env.APP_URL) !== null },
  ];
}
