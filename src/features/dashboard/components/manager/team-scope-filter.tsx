"use client";

import { useState } from "react";
import { ExportLinks } from "@/features/export/components/export-links";
import { cn } from "@/lib/utils";

export type PeriodFilter = "month" | "quarter" | "year";

export function TeamScopeFilter({
  teams,
  selectedTeam,
  onSelectTeam,
}: {
  teams: { name: string; memberCount: number }[];
  selectedTeam: string | null;
  onSelectTeam: (team: string | null) => void;
}) {
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const totalMembers = teams.reduce((acc, t) => acc + t.memberCount, 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      {/* Team scope pills */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by team scope">
        <button
          type="button"
          onClick={() => onSelectTeam(null)}
          className={cn(
            "rounded-full px-3 py-1 text-caption font-medium transition-colors font-mono",
            selectedTeam === null
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground hover:bg-muted/60",
          )}
        >
          All teams ({totalMembers})
        </button>

        {teams.map((t) => {
          const isSelected = selectedTeam === t.name;
          return (
            <button
              type="button"
              key={t.name}
              onClick={() => onSelectTeam(isSelected ? null : t.name)}
              className={cn(
                "rounded-full px-3 py-1 text-caption font-medium transition-colors font-mono",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted/60",
              )}
            >
              {t.name} ({t.memberCount})
            </button>
          );
        })}
      </div>

      {/* Period selector and Download action */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-caption font-medium">
          <button
            type="button"
            onClick={() => setPeriod("month")}
            className={cn(
              "rounded-full px-3 py-0.5 transition-colors font-sans",
              period === "month"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setPeriod("quarter")}
            className={cn(
              "rounded-full px-3 py-0.5 transition-colors font-sans",
              period === "quarter"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Quarter
          </button>
          <button
            type="button"
            onClick={() => setPeriod("year")}
            className={cn(
              "rounded-full px-3 py-0.5 transition-colors font-sans",
              period === "year"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Year
          </button>
        </div>

        <ExportLinks label="Download report" />
      </div>
    </div>
  );
}
