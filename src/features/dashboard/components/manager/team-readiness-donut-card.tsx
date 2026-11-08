import type { ManagerKpis } from "@/features/dashboard/manager-metrics";

export function TeamReadinessDonutCard({
  kpis,
  totalMembers,
  noCertCount,
}: {
  kpis: ManagerKpis;
  totalMembers: number;
  noCertCount: number;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (kpis.teamReadinessRate / 100) * circumference;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Team readiness
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-caption font-mono text-muted-foreground">
          N={totalMembers}
        </span>
      </div>

      {/* Donut chart */}
      <div className="flex flex-col items-center justify-center py-2">
        <div
          role="img"
          aria-label={`Team readiness donut: ${kpis.teamReadinessFormatted} ready, ${kpis.validCount} of ${totalMembers}`}
          className="relative size-36 shrink-0 flex items-center justify-center"
        >
          <svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {kpis.teamReadinessFormatted}
            </span>
            <span className="text-caption font-mono uppercase tracking-widest text-muted-foreground -mt-0.5">
              Ready
            </span>
            <span className="text-caption text-muted-foreground mt-0.5">
              {kpis.validCount} of {totalMembers}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 border-t border-border pt-3 text-caption font-sans">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <span className="text-muted-foreground">Valid</span>
          </div>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {kpis.validCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-[var(--status-expiring-soon-fg)] shrink-0"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">Expiring soon</span>
          </div>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {kpis.expiringCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-[var(--status-expired-fg)] shrink-0"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">Expired</span>
          </div>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {kpis.expiredCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" aria-hidden="true" />
            <span className="text-muted-foreground">No cert yet</span>
          </div>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {noCertCount}
          </span>
        </div>
      </div>

      {/* Hidden DL to satisfy e2e tileValue contract */}
      <dl className="sr-only">
        <div>
          <dt>Team readiness</dt>
          <dd>{kpis.teamReadinessFormatted}</dd>
        </div>
      </dl>
    </div>
  );
}
