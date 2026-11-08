import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { countIssuedThisMonth } from "@/features/dashboard/admin-metrics";
import { ChartLoadError } from "@/features/dashboard/components/chart-load-error";
import { expiringCerts, validCerts } from "@/features/dashboard/metrics";
import type { BreakdownRow, DashboardKpis } from "@/features/dashboard/schema";
import type { RecordRow } from "@/features/records/queries";
import { formatNumber } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import type { Result } from "@/lib/result";

export function AdminKpiCards({
  kpis,
  records,
  teams,
}: {
  kpis: DashboardKpis;
  records: RecordRow[];
  teams: Result<BreakdownRow[]>;
}) {
  const completed = kpis.doneRecords;
  const valid = validCerts(kpis);
  const validRate = completed > 0 ? Math.round((valid / completed) * 100) : 0;
  const expiring60 = expiringCerts(kpis);
  const urgentCount = kpis.expiringSoonCerts;
  const expiring31to60Count = kpis.expiring60Certs;
  const moreThan60Count = kpis.activeCerts;
  const expired = kpis.expiredCerts;
  const issuedThisMonth = countIssuedThisMonth(records);

  const teamsList = teams.ok ? teams.data : [];
  // Group summary for Certificates by group image assertion
  const groupsSummary = teamsList.map((t) => `${t.label} ${t.records}`).join(", ");

  // Circular ring dash calculation (circumference of r=14 is 2 * PI * 14 ~= 87.96)
  const circumference = 88;
  const dashOffset = circumference - (circumference * validRate) / 100;

  return (
    <section aria-label="Overview" className="flex flex-col gap-4">
      <h2 className="sr-only">Overview</h2>

      {/* Top 4 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Valid certificates (Solid Primary Teal) */}
        <div className="flex flex-col justify-between gap-3 rounded-lg bg-primary text-primary-foreground p-4 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-label uppercase tracking-wider font-mono opacity-80">
              Audit status
            </span>
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-caption font-semibold font-mono text-primary-foreground">
              {validRate}%
            </span>
          </div>

          <dl className="flex items-baseline justify-between gap-2">
            <div>
              <dt className="text-xs opacity-80">Valid</dt>
              <dd className="text-2xl font-bold font-mono tracking-tight text-primary-foreground">
                {valid}
              </dd>
            </div>
            <div className="text-right text-caption opacity-80 font-mono">
              / {completed} pool
            </div>
          </dl>

          <div className="flex items-center justify-between border-t border-primary-foreground/20 pt-2">
            <div
              role="img"
              aria-label={`Valid certificates: ${valid} of ${completed} completed`}
              className="flex items-center gap-2"
            >
              <svg className="size-6 shrink-0" viewBox="0 0 36 36" aria-hidden="true">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="opacity-25"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transform -rotate-90 origin-center"
                />
              </svg>
              <span className="text-caption opacity-90 truncate">
                {issuedThisMonth > 0
                  ? `${issuedThisMonth} issued this month`
                  : "All credentials verified"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Expiring within 60 days */}
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
              Timeline
            </span>
            <Badge variant="outline" className="font-mono text-caption text-muted-foreground">
              {completed > 0 ? `${Math.round((expiring60 / completed) * 100)}% Pool` : "0%"}
            </Badge>
          </div>

          <dl>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Expiring within 60 days</dt>
              <dd className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {expiring60}
              </dd>
            </div>
          </dl>

          {/* Accessible Expiring Within 60 Days Image */}
          <div
            role="img"
            aria-label={`Expiring within 60 days: ${pluralize(expiring60, "certificate")} (${completed > 0 ? Math.round((expiring60 / completed) * 100) : 0}% of completed)`}
            className="sr-only"
          />

          {/* Folded Certificate Expiry Region */}
          <section aria-label="Certificate expiry" className="border-t border-border pt-2 min-w-0">
            <div
              role="img"
              aria-label={`Certificate expiry: Expires within 30 days ${urgentCount}, Expires in 31–60 days ${expiring31to60Count}, More than 60 days ${moreThan60Count}`}
              className="flex items-center gap-3 text-caption font-mono text-muted-foreground"
            >
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-[var(--status-expiring-soon-fg)]" aria-hidden="true" />
                <span>&le;30d: {urgentCount}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
                <span>31–60d: {expiring31to60Count}</span>
              </span>
            </div>
            <ul className="sr-only">
              <li>Expires within 30 days: {urgentCount}</li>
              <li>Expires in 31–60 days: {expiring31to60Count}</li>
              <li>More than 60 days: {moreThan60Count}</li>
            </ul>
          </section>
        </div>

        {/* Card 3: Expired */}
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
              Audit risk
            </span>
            {expired > 0 ? (
              <Badge variant="destructive" className="font-mono text-caption">
                Flagged
              </Badge>
            ) : (
              <Badge variant="outline" className="font-mono text-caption text-muted-foreground">
                0 expired
              </Badge>
            )}
          </div>

          <dl>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Expired</dt>
              <dd
                className={`text-2xl font-bold font-mono tracking-tight ${expired > 0 ? "text-destructive" : "text-foreground"}`}
              >
                {expired}
              </dd>
            </div>
          </dl>

          <div className="border-t border-border pt-2">
            {!teams.ok ? (
              <ChartLoadError />
            ) : expired === 0 ? (
              <div
                role="img"
                aria-label="No expired certificates. All completed certificates are up to date."
                className="flex items-center gap-2 text-caption text-muted-foreground"
              >
                <CheckCircle2 className="size-4 text-[var(--status-active-fg)] shrink-0" aria-hidden="true" />
                <span className="truncate">All certificates up to date</span>
              </div>
            ) : (
              <div
                role="img"
                aria-label={`Expired certificates: ${expired}`}
                className="flex items-center gap-1.5 text-caption text-destructive font-mono truncate"
              >
                <span>Requires immediate renewal</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Waiting for approval (Coming soon tile) */}
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
              Workflow
            </span>
            <Badge variant="outline" className="border-dashed font-mono text-caption text-muted-foreground">
              Soon
            </Badge>
          </div>

          <dl>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Waiting for approval</dt>
              <dd className="text-2xl font-bold font-mono tracking-tight text-muted-foreground">
                —
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-1.5 border-t border-border/60 pt-2 text-caption text-muted-foreground">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Not available yet.</span>
          </div>
        </div>
      </div>

      {/* Slim Stat Strip under KPI Row (preserves e2e contract & live-update test) */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-border bg-card p-3.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-xs text-muted-foreground truncate">Active members</dt>
          <dd className="text-lg font-bold font-mono text-foreground tabular-nums">
            {formatNumber(kpis.totalMembers)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-xs text-muted-foreground truncate">Certificates</dt>
          <dd className="text-lg font-bold font-mono text-foreground tabular-nums">
            {formatNumber(kpis.totalRecords)}
          </dd>
          {/* Accessible Certificates by group image */}
          <div
            role="img"
            aria-label={`Certificates by group: ${groupsSummary}`}
            className="sr-only"
          />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-xs text-muted-foreground truncate">Completed</dt>
          <dd className="text-lg font-bold font-mono text-foreground tabular-nums">
            {formatNumber(kpis.doneRecords)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-xs text-muted-foreground truncate">In progress</dt>
          <dd className="text-lg font-bold font-mono text-foreground tabular-nums">
            {formatNumber(kpis.inProgressRecords)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
