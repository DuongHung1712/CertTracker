"use client";

import { cn } from "@/lib/utils";

export function TeamScopeFilter({
  teams,
  selectedTeam,
  onSelectTeam,
}: {
  teams: { name: string; memberCount: number }[];
  selectedTeam: string | null;
  onSelectTeam: (team: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-4" role="group" aria-label="Filter by team scope">
      <button
        type="button"
        aria-pressed={selectedTeam === null}
        onClick={() => onSelectTeam(null)}
        className={cn(
          "min-h-8 rounded-lg px-3 py-1 font-mono text-caption font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          selectedTeam === null
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-muted-foreground hover:bg-muted/60",
        )}
      >
        All teams
      </button>

      {teams.map((t) => {
        const isSelected = selectedTeam === t.name;
        return (
          <button
            type="button"
            key={t.name}
            aria-pressed={isSelected}
            onClick={() => onSelectTeam(isSelected ? null : t.name)}
            className={cn(
              "min-h-8 rounded-lg px-3 py-1 font-mono text-caption font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted/60",
            )}
          >
            {`${t.name} (${t.memberCount})`}
          </button>
        );
      })}
    </div>
  );
}
