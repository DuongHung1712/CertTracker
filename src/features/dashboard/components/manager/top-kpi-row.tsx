import { AlertCircle, Clock } from "lucide-react";
import type { ManagerKpis } from "@/features/dashboard/manager-metrics";
import { cn } from "@/lib/utils";

const KPI_TILE_MIN_HEIGHT = "min-h-[140px]";

export function TopKpiRow({
  kpis,
  pastDueText,
}: {
  kpis: ManagerKpis;
  pastDueText?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
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
            <div className="flex items-center justify-between">
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
                ? `${kpis.expiringCount} in ≤30d window`
                : "None in 60-day window"}
            </span>
          </div>

          <div className="border-t border-border/60 pt-2 flex items-center justify-between text-caption font-mono text-muted-foreground">
            <span>Next 60 days</span>
            <span className="tabular-nums font-semibold text-foreground">
              {kpis.expiringCount}
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
            <div className="flex items-center justify-between">
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

          <div className="border-t border-border/60 pt-2 flex items-center justify-between text-caption text-muted-foreground truncate">
            <span className="truncate">
              {kpis.expiredCount > 0 && pastDueText
                ? `Past due: ${pastDueText}`
                : "All current valid"}
            </span>
          </div>
        </div>

        {/* 3. Waiting approval (Coming soon) */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-lg border border-dashed border-border p-3.5 bg-card/60",
            KPI_TILE_MIN_HEIGHT,
          )}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <dt className="text-label uppercase tracking-wider font-mono text-muted-foreground">
                Waiting for approval
              </dt>
              <span className="rounded border border-border px-1.5 py-0.5 text-caption font-mono text-muted-foreground">
                Soon
              </span>
            </div>
            <dd className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums font-mono text-muted-foreground mt-1">
              0
            </dd>
            <span className="text-caption text-muted-foreground">
              0 proofs queued
            </span>
          </div>

          <div className="border-t border-dashed border-border/60 pt-2 text-caption text-muted-foreground truncate">
            <span>Approvals queue · Coming soon</span>
          </div>
        </div>
      </dl>
    </div>
  );
}
