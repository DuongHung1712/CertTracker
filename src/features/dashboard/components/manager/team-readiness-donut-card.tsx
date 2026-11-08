import type { ManagerKpis } from "@/features/dashboard/manager-metrics";

export function TeamReadinessDonutCard({
  kpis,
  noCertCount,
}: {
  kpis: ManagerKpis;
  noCertCount: number;
}) {
  const hasCompleted = kpis.doneCount > 0;
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
      </div>

      {/* Donut chart */}
      <div className="flex flex-col items-center justify-center py-2">
        <div
          role="img"
          aria-label={
            hasCompleted
              ? `Team readiness donut: ${kpis.teamReadinessFormatted} ready, ${kpis.validCount} of ${kpis.doneCount} completed certificates`
              : "Team readiness donut: no completed certificates"
          }
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
              {hasCompleted ? kpis.teamReadinessFormatted : "—"}
            </span>
            <span className="text-caption font-mono uppercase tracking-widest text-muted-foreground -mt-0.5">
              Ready
            </span>
          </div>
        </div>
        <p className="mt-2 text-center text-caption text-muted-foreground">
          {hasCompleted
            ? `${kpis.validCount} of ${kpis.doneCount} completed certificates`
            : "No completed certificates"}
        </p>
      </div>

      {/* Legend: Valid and Expired are the donut centre and the Expired tile; this is the one number they lack. */}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-caption font-sans">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground">Members without a completed certificate</span>
        </div>
        <span className="font-mono font-semibold tabular-nums text-foreground">{noCertCount}</span>
      </div>

      {/* Hidden DL to satisfy e2e tileValue contract */}
      <dl className="sr-only">
        <div>
          <dt>Team readiness</dt>
          <dd>{hasCompleted ? kpis.teamReadinessFormatted : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
