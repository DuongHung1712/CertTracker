import { monthLabel, weekLabel } from "@/features/notifications/period";
import type { NotificationKind } from "@/features/notifications/types";

export type LogRow = {
  kind: NotificationKind;
  period: string;
  status: "pending" | "sent" | "failed";
  sentAt: string | null;
  claimedAt: string;
};

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
};

function labelOf(kind: NotificationKind, period: string): string {
  try {
    return kind === "expiry-alert" ? weekLabel(period) : monthLabel(period);
  } catch {
    // A malformed period must not take the whole page down; show it as written.
    return period;
  }
}

/** One row per (kind, period): how many recipients are sent / failed / still pending. Newest first. */
export function summarizeRuns(rows: LogRow[]): RunRow[] {
  const groups = new Map<string, { run: RunRow; lastMs: number }>();
  for (const r of rows) {
    const key = `${r.kind}|${r.period}`;
    const activityAt = r.sentAt ?? r.claimedAt;
    const activityMs = Date.parse(activityAt);
    let group = groups.get(key);
    if (!group) {
      group = {
        run: { kind: r.kind, period: r.period, label: labelOf(r.kind, r.period), sent: 0, failed: 0, pending: 0, lastActivityAt: activityAt },
        lastMs: activityMs,
      };
      groups.set(key, group);
    }
    group.run[r.status] += 1;
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
    { id: "app-url", label: "APP_URL (liên kết trong email)", ok: Boolean(env.APP_URL) },
  ];
}
