import { AlertCircle, Award, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import type { MemberKpis } from "@/features/dashboard/member-metrics";
import { formatRate, ratePercent } from "@/features/dashboard/metrics";
import { daysLeftLabel, pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";

/** Keeps the four tiles the same height whatever they hold. */
const KPI_TILE_MIN_HEIGHT = "min-h-[175px]";

export function MemberKpiCards({ kpis }: { kpis: MemberKpis }) {
  const compliance = formatRate(ratePercent(kpis.validCount, kpis.total));

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3">
      {/* 1. All certificates, in solid primary */}
      <div className={cn("flex flex-col justify-between rounded-lg border border-transparent bg-primary p-3.5 text-primary-foreground", KPI_TILE_MIN_HEIGHT)}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase tracking-wider text-primary-foreground/80 font-mono">
              Certificates
            </dt>
            <Award className="size-3.5 text-primary-foreground/80 shrink-0" aria-hidden="true" />
          </div>
          <dd className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-primary-foreground mt-1">
            {kpis.total}
          </dd>
          <dd className="text-caption text-primary-foreground/80 leading-tight">
            Including courses not started or in progress
          </dd>
        </div>

        <div className="border-t border-primary-foreground/20 pt-2 flex flex-col gap-1.5">
          <div className="inline-flex items-center self-start rounded border border-primary-foreground/30 px-1.5 py-0.5 text-caption font-medium text-primary-foreground">
            {`${compliance} valid (${kpis.validCount} of ${kpis.total})`}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-caption font-mono text-primary-foreground/90">
            <span className="rounded border border-primary-foreground/30 px-1 py-0.5">{kpis.expiringCount} expiring</span>
            <span className="rounded border border-primary-foreground/30 px-1 py-0.5">{kpis.inProgressCount} in progress</span>
          </div>
        </div>
      </div>

      {/* 2. Expiring within 60 days: amber border and warning accent */}
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
          <dd
            className={cn(
              "text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1",
              kpis.expiringCount > 0
                ? "text-[var(--status-expiring-soon-fg)]"
                : "text-foreground",
            )}
          >
            {kpis.expiringCount}
          </dd>
          <dd className="text-caption text-muted-foreground leading-tight">
            Valid, 60 days or less left
          </dd>
        </div>

        <div className="border-t border-border pt-2 flex flex-col gap-0.5 text-caption">
          {kpis.leastDaysRecord ? (
            <>
              <span className="font-medium text-foreground truncate max-w-full" title={kpis.leastDaysRecord.certificateName}>
                Next to expire: {kpis.leastDaysRecord.certificateName}
              </span>
              <span className="font-mono text-caption font-semibold text-[var(--status-expiring-soon-fg)]">
                {daysLeftLabel(kpis.leastDaysRecord.daysToExpiry)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-caption">All up to date</span>
          )}
        </div>
      </div>

      {/* 3. In progress: active study goals */}
      <div className={cn("flex flex-col justify-between rounded-lg border border-border bg-card p-3.5", KPI_TILE_MIN_HEIGHT)}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase tracking-wider font-mono text-muted-foreground">
              In progress
            </dt>
            <PlayCircle className="size-3.5 text-primary shrink-0" aria-hidden="true" />
          </div>
          <dd className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-foreground mt-1">
            {kpis.inProgressCount}
          </dd>
          <dd className="text-caption text-muted-foreground leading-tight">
            Courses in progress
          </dd>
        </div>

        <div className="border-t border-border pt-2 flex flex-col gap-1 text-caption">
          {kpis.inProgressRows.length > 0 ? (
            kpis.inProgressRows.slice(0, 2).map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded bg-muted/50 px-1.5 py-0.5 font-mono"
              >
                <span className="truncate max-w-[90px] font-medium text-foreground">
                  {row.certificateName}
                </span>
                <span className="font-semibold text-foreground">{row.progress}%</span>
              </div>
            ))
          ) : (
            <span className="text-muted-foreground text-caption">No courses in progress</span>
          )}
        </div>
      </div>

      {/* 4. Expired: status check and compliance note */}
      <div className={cn("flex flex-col justify-between rounded-lg border border-border bg-card p-3.5", KPI_TILE_MIN_HEIGHT)}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase tracking-wider font-mono text-muted-foreground">
              Expired
            </dt>
            {kpis.expiredCount > 0 ? (
              <AlertCircle className="size-3.5 text-destructive shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-3.5 text-[var(--status-active-fg)] shrink-0" aria-hidden="true" />
            )}
          </div>
          <dd
            className={cn(
              "text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1",
              kpis.expiredCount > 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {kpis.expiredCount}
          </dd>
          <dd className="text-caption text-muted-foreground leading-tight">
            {kpis.expiredCount === 0 ? "All up to date" : "Needs renewal"}
          </dd>
        </div>

        <div className="border-t border-border pt-2 text-caption text-muted-foreground leading-tight">
          {kpis.expiredCount === 0
            ? "No expired certificates."
            : `${pluralize(kpis.expiredCount, "certificate")} ${kpis.expiredCount === 1 ? "needs" : "need"} renewal.`}
        </div>
      </div>
    </dl>
  );
}
