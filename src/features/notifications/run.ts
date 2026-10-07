import { deliver, type DeliverResult, type Outbound } from "@/features/notifications/deliver";
import { buildExpiryEmail, buildMonthlyEmail } from "@/features/notifications/emails";
import { planExpiryAlerts } from "@/features/notifications/expiry-plan";
import type { NotificationLedger } from "@/features/notifications/ledger";
import { planMonthlyReports } from "@/features/notifications/monthly-plan";
import { isoWeekKey, previousMonthKey } from "@/features/notifications/period";
import type { NotificationKind, Snapshot } from "@/features/notifications/types";
import type { EmailSender } from "@/lib/email/sender";

export type RunSummary = DeliverResult & {
  job: NotificationKind;
  period: string;
  transport: EmailSender["transport"];
  dryRun: boolean;
  undeliverable: string[];
};

export type RunDeps = {
  snapshot: Snapshot;
  /** Today in Vietnam, `YYYY-MM-DD` (`todayVn()`); a parameter so tests never read the clock. */
  today: string;
  appUrl: string | null;
  ledger: NotificationLedger;
  sender: EmailSender;
  dryRun: boolean;
  now: () => number;
  deadlineMs: number;
};

async function run(
  kind: NotificationKind,
  period: string,
  outbound: Outbound[],
  undeliverable: string[],
  deps: RunDeps,
): Promise<RunSummary> {
  const { ledger, sender, dryRun, now, deadlineMs } = deps;
  const result = await deliver({ kind, period, outbound, ledger, sender, dryRun, now, deadlineMs });
  return { job: kind, period, transport: sender.transport, dryRun, undeliverable, ...result };
}

export function runExpiryAlerts(deps: RunDeps): Promise<RunSummary> {
  const period = isoWeekKey(deps.today);
  const { alerts, undeliverable } = planExpiryAlerts(deps.snapshot);
  const outbound: Outbound[] = alerts.map((alert) => ({
    email: alert.email,
    detail: {
      own: alert.own.length,
      teams: alert.teams.length,
      teamItems: alert.teams.reduce((n, t) => n + t.items.length, 0),
    },
    render: () => buildExpiryEmail(alert, { period, appUrl: deps.appUrl }),
  }));
  return run("expiry-alert", period, outbound, undeliverable, deps);
}

export function runMonthlyReport(deps: RunDeps): Promise<RunSummary> {
  const period = previousMonthKey(deps.today);
  const { reports, undeliverable } = planMonthlyReports(deps.snapshot, period);
  const outbound: Outbound[] = reports.map((report) => ({
    email: report.email,
    detail: { members: report.overall.members, teams: report.teams.length, upcoming: report.upcoming.length },
    render: () => buildMonthlyEmail(report, { appUrl: deps.appUrl, today: deps.today }),
  }));
  return run("monthly-report", period, outbound, undeliverable, deps);
}
