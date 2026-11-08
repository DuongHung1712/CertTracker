import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { ExpiringGaugeMiniChart } from "@/features/dashboard/components/hero-charts";
import type { ManagerKpis } from "@/features/dashboard/manager-metrics";
import { cn } from "@/lib/utils";

const KPI_TILE_MIN_HEIGHT = "min-h-[180px]";

export function ManagerKpiCards({ kpis }: { kpis: ManagerKpis }) {
  // SVG Ring calculation for Team Readiness
  // Circumference for r=24: 2 * pi * 24 ≈ 150.796
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (kpis.teamReadinessRate / 100) * circumference;

  return (
    <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Team readiness: inverted solid-teal highlight card */}
      <div
        className={cn(
          "flex flex-col justify-between rounded-lg border border-transparent bg-primary p-3.5 text-primary-foreground",
          KPI_TILE_MIN_HEIGHT,
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase tracking-wider font-mono text-primary-foreground/80">
              Team readiness
            </dt>
            <CheckCircle2 className="size-3.5 text-primary-foreground/80 shrink-0" aria-hidden="true" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <dd className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-primary-foreground">
              {kpis.teamReadinessFormatted}
            </dd>
            <div
              role="img"
              aria-label={`Team readiness ring: ${kpis.teamReadinessFormatted} valid certificates`}
              className="relative size-12 shrink-0 flex items-center justify-center"
            >
              <svg className="size-full -rotate-90" viewBox="0 0 60 60" aria-hidden="true">
                <circle
                  cx="30"
                  cy="30"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-primary-foreground/20"
                />
                <circle
                  cx="30"
                  cy="30"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="text-primary-foreground"
                />
              </svg>
            </div>
          </div>
          <dd className="text-caption text-primary-foreground/80 leading-tight">
            {kpis.validCount} of {kpis.doneCount} completed valid
          </dd>
        </div>

        <div className="border-t border-primary-foreground/20 pt-2 flex flex-wrap items-center gap-1.5 text-caption font-mono text-primary-foreground/90">
          <span className="rounded border border-primary-foreground/30 px-1.5 py-0.5">
            {kpis.validCount} valid
          </span>
          <span className="rounded border border-primary-foreground/30 px-1.5 py-0.5">
            {kpis.expiringCount} expiring
          </span>
          <span className="rounded border border-primary-foreground/30 px-1.5 py-0.5">
            {kpis.inProgressCount} in progress
          </span>
        </div>
      </div>

      {/* 2. Expiring within 60 days */}
      <div
        className={cn(
          "flex flex-col justify-between rounded-lg border p-3.5 bg-card",
          KPI_TILE_MIN_HEIGHT,
          kpis.expiringCount > 0 ? "border-[var(--status-expiring-soon-border)]" : "border-border",
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt
              className={cn(
                "text-label uppercase tracking-wider font-mono",
                kpis.expiringCount > 0 ? "text-[var(--status-expiring-soon-fg)]" : "text-muted-foreground",
              )}
            >
              Expiring within 60 days
            </dt>
            <Clock
              className={cn(
                "size-3.5 shrink-0",
                kpis.expiringCount > 0 ? "text-[var(--status-expiring-soon-fg)]" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
          </div>
          <dd
            className={cn(
              "text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1",
              kpis.expiringCount > 0 ? "text-[var(--status-expiring-soon-fg)] font-semibold" : "text-foreground",
            )}
          >
            {kpis.expiringCount}
          </dd>
          <dd className="text-caption text-muted-foreground leading-tight">
            Completed certificates with 60 days or less left
          </dd>
        </div>

        <div className="pt-2">
          <ExpiringGaugeMiniChart
            expiringCount={kpis.expiringCount}
            totalCompleted={kpis.doneCount}
          />
        </div>
      </div>

      {/* 3. Expired: count + positive state or bars */}
      <div
        className={cn(
          "flex flex-col justify-between rounded-lg border p-3.5 bg-card",
          KPI_TILE_MIN_HEIGHT,
          kpis.expiredCount > 0 ? "border-destructive/40" : "border-border",
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt
              className={cn(
                "text-label uppercase tracking-wider font-mono",
                kpis.expiredCount > 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              Expired
            </dt>
            <AlertCircle
              className={cn(
                "size-3.5 shrink-0",
                kpis.expiredCount > 0 ? "text-destructive" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
          </div>
          <dd
            className={cn(
              "text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1",
              kpis.expiredCount > 0 ? "text-destructive font-semibold" : "text-foreground",
            )}
          >
            {kpis.expiredCount}
          </dd>
          <dd className="text-caption text-muted-foreground leading-tight">
            Completed certificates past their expiry date
          </dd>
        </div>

        <div className="pt-2">
          {kpis.expiredCount === 0 ? (
            <div
              role="img"
              aria-label="No expired certificates. All completed certificates are up to date."
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/80 bg-muted/20 p-2 text-center"
            >
              <CheckCircle2 className="size-4 text-[var(--status-active-fg)]" aria-hidden />
              <span className="text-caption font-semibold text-foreground">No expired certificates</span>
              <span className="text-caption text-muted-foreground">All completed certificates are up to date</span>
            </div>
          ) : (
            <div
              role="img"
              aria-label={`${kpis.expiredCount} expired certificates require renewal`}
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-center text-destructive"
            >
              <AlertCircle className="size-4" aria-hidden />
              <span className="text-caption font-semibold">{kpis.expiredCount} expired certificates</span>
              <span className="text-caption text-destructive/80">Requires immediate renewal</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Waiting for approval (Coming soon) */}
      <div
        className={cn(
          "flex flex-col justify-between rounded-lg border border-dashed border-border bg-card p-3.5",
          KPI_TILE_MIN_HEIGHT,
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase tracking-wider font-mono text-muted-foreground">
              Waiting for approval
            </dt>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-caption font-medium text-muted-foreground">
              <Clock className="size-3 text-muted-foreground" aria-hidden />
              <span>Coming soon</span>
            </span>
          </div>
          <dd className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-muted-foreground mt-1">
            0
          </dd>
          <dd className="text-caption text-muted-foreground leading-tight">
            Verification queue for submitted certificate evidence
          </dd>
        </div>

        <div className="border-t border-border/80 pt-2 text-caption text-muted-foreground">
          Approvals workflow not available yet.
        </div>
      </div>
    </dl>
  );
}
