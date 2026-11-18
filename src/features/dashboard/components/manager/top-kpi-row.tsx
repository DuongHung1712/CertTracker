import { AlertCircle, Clock } from "lucide-react";
import { KpiGroup } from "@/features/dashboard/components/kpi-group";
import { WaitingTile } from "@/features/dashboard/components/waiting-tile";
import { StatStrip } from "@/features/dashboard/components/stat-strip";
import type { CompletionKpis } from "@/features/dashboard/completion-metrics";
import type { ManagerKpis } from "@/features/dashboard/manager-metrics";
import { cn } from "@/lib/utils";

const KPI_TILE_MIN_HEIGHT = "min-h-[140px]";

export function TopKpiRow({
  kpis,
  completions,
  plannedExams,
  pastDueText,
  waiting,
}: {
  /** Exam certificates only (see `calculateManagerKpis`). */
  kpis: ManagerKpis;
  completions: CompletionKpis;
  /** Planned exams in the next 60 days: the length of the Planned exams list. */
  plannedExams: number;
  pastDueText?: string;
  /** Completed items in scope that wait for approval. */
  waiting: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <KpiGroup title="Exam certificates">
        <ExamTiles kpis={kpis} pastDueText={pastDueText} waiting={waiting} />
        <StatStrip
          stats={[
            ["Valid", kpis.validCount],
            ["Completed", kpis.doneCount],
            ["In progress", kpis.inProgressCount],
            ["Planned exams", plannedExams],
          ]}
        />
      </KpiGroup>
      <KpiGroup title="Course completions">
        <StatStrip
          stats={[
            ["Completed, all time", completions.doneTotal],
            ["Completed this month", completions.doneThisMonth],
            ["Completed this quarter", completions.doneThisQuarter],
            ["Completions in progress", completions.inProgress],
          ]}
        />
      </KpiGroup>
    </div>
  );
}

function ExamTiles({ kpis, pastDueText, waiting }: { kpis: ManagerKpis; pastDueText?: string; waiting: number }) {
  return (
    <div className="@container">
    <div className="grid grid-cols-1 gap-3.5 @md:grid-cols-3">
      {/* 1. Expiring in 60 days */}
      <dl className="m-0 p-0 contents">
        <div
          className={cn(
            "flex flex-col justify-between rounded-lg border p-3.5 bg-card",
            KPI_TILE_MIN_HEIGHT,
            kpis.expiringCount > 0
              ? "border-[var(--status-expiring-soon-border)]"
              : "border-border",
          )}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <dt
                className={cn(
                  "text-label uppercase tracking-wider font-mono",
                  kpis.expiringCount > 0
                    ? "text-[var(--status-expiring-soon-fg)]"
                    : "text-muted-foreground",
                )}
              >
                Expiring within 60 days
              </dt>
              <Clock
                className={cn(
                  "size-3.5 shrink-0",
                  kpis.expiringCount > 0
                    ? "text-[var(--status-expiring-soon-fg)]"
                    : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            </div>
            <dd className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums font-mono text-foreground mt-1">
              {kpis.expiringCount}
            </dd>
            <span className="text-caption text-muted-foreground">
              {kpis.expiringCount > 0
                ? `${kpis.urgentCount} with 30 days or less`
                : "None in 60-day window"}
            </span>
          </div>
        </div>

        {/* 2. Expired deficit */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-lg border p-3.5 bg-card",
            KPI_TILE_MIN_HEIGHT,
            kpis.expiredCount > 0
              ? "border-[var(--status-expired-border)]"
              : "border-border",
          )}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <dt
                className={cn(
                  "text-label uppercase tracking-wider font-mono",
                  kpis.expiredCount > 0
                    ? "text-[var(--status-expired-fg)]"
                    : "text-muted-foreground",
                )}
              >
                Expired
              </dt>
              <AlertCircle
                className={cn(
                  "size-3.5 shrink-0",
                  kpis.expiredCount > 0
                    ? "text-[var(--status-expired-fg)]"
                    : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <dd
                className={cn(
                  "text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums font-mono",
                  kpis.expiredCount > 0
                    ? "text-[var(--status-expired-fg)]"
                    : "text-foreground",
                )}
              >
                {kpis.expiredCount}
              </dd>
              {kpis.expiredCount > 0 && (
                <div className="h-1.5 w-12 rounded-full bg-[var(--status-expired-bg)] overflow-hidden">
                  <div className="h-full w-full bg-[var(--status-expired-fg)]" />
                </div>
              )}
            </div>
            <span className="text-caption text-muted-foreground">
              Past validity date
            </span>
          </div>

          <div className="border-t border-border/60 pt-2 flex items-center justify-between text-caption text-muted-foreground">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {kpis.expiredCount > 0 && pastDueText
                ? `Past due: ${pastDueText}`
                : "No expired certificates"}
            </span>
          </div>
        </div>
      </dl>
      <WaitingTile count={waiting} />
    </div>
    </div>
  );
}
