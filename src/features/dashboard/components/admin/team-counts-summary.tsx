import type { BreakdownRow } from "@/features/dashboard/schema";
import type { Result } from "@/lib/result";

function teamSummary(teams: Result<BreakdownRow[]>): string {
  if (!teams.ok || teams.data.length === 0) return "no teams yet";
  return teams.data.map((t) => `${t.label} ${t.records}`).join(", ");
}

/** Screen-reader summary of how many certificates each team has (the figure is not drawn). */
export function TeamCountsSummary({ teams }: { teams: Result<BreakdownRow[]> }) {
  return <span role="img" aria-label={`Certificates by team: ${teamSummary(teams)}`} className="sr-only" />;
}
