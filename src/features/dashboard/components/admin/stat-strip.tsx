import type { BreakdownRow, DashboardKpis } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";
import type { Result } from "@/lib/result";

function teamSummary(teams: Result<BreakdownRow[]>): string {
  if (!teams.ok || teams.data.length === 0) return "no teams yet";
  return teams.data.map((t) => `${t.label} ${t.records}`).join(", ");
}

export function StatStrip({ kpis, teams }: { kpis: DashboardKpis; teams: Result<BreakdownRow[]> }) {
  const stats = [
    ["Active members", kpis.totalMembers],
    ["Certificates", kpis.totalRecords],
    ["Completed", kpis.doneRecords],
    ["In progress", kpis.inProgressRecords],
  ] as const;

  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([term, value]) => (
          <div key={term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="truncate text-xs text-muted-foreground">{term}</dt>
            <dd className="font-mono text-lg font-bold tabular-nums text-foreground">{formatNumber(value)}</dd>
          </div>
        ))}
      </dl>
      <span role="img" aria-label={`Certificates by team: ${teamSummary(teams)}`} className="sr-only" />
    </div>
  );
}
