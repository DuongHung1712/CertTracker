import { AlertCircle, Award, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import type { MemberKpis } from "@/features/dashboard/member-metrics";
import { cn } from "@/lib/utils";

export function MemberKpiCards({ kpis }: { kpis: MemberKpis }) {
  return (
    <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Recorded certificates: Inverted solid-teal highlight card */}
      <div className="flex min-h-[160px] flex-col justify-between rounded-lg border border-transparent bg-primary p-4 text-primary-foreground">
        <div className="flex items-center justify-between">
          <dt className="text-label uppercase tracking-wider text-primary-foreground-muted">
            Recorded certificates
          </dt>
          <Award className="size-4 text-primary-foreground-muted" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <dd className="text-kpi font-semibold tabular-nums text-primary-foreground">
            {kpis.total}
          </dd>
          <dd className="text-caption text-primary-foreground-muted">
            {kpis.validCount} valid of {kpis.total}
          </dd>
        </div>
      </div>

      {/* 2. Expiring soon: Nearest expiry details */}
      <div className="flex min-h-[160px] flex-col justify-between rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <dt className="text-label uppercase tracking-wider text-muted-foreground">
            Expiring soon
          </dt>
          <Clock className="size-4 text-[var(--status-expiring-soon-fg)]" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <dd className="text-kpi font-semibold tabular-nums text-foreground">
            {kpis.expiringCount}
          </dd>
          <dd className="text-caption text-muted-foreground truncate" title={kpis.leastDaysRecord ? `${kpis.leastDaysRecord.courseName} · ${kpis.leastDaysRecord.daysToExpiry} days left` : undefined}>
            {kpis.leastDaysRecord ? (
              <>
                <span className="font-medium text-foreground">{kpis.leastDaysRecord.courseName}</span>
                <span className="mx-1">·</span>
                <span>
                  {kpis.leastDaysRecord.daysToExpiry}{" "}
                  {kpis.leastDaysRecord.daysToExpiry === 1 ? "day" : "days"} left
                </span>
              </>
            ) : (
              "None expiring within 60 days"
            )}
          </dd>
        </div>
      </div>

      {/* 3. In progress: Count plus mini progress bars */}
      <div className="flex min-h-[160px] flex-col justify-between rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <dt className="text-label uppercase tracking-wider text-muted-foreground">
            In progress
          </dt>
          <PlayCircle className="size-4 text-primary" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <dd className="text-kpi font-semibold tabular-nums text-foreground">
            {kpis.inProgressCount}
          </dd>
          {kpis.inProgressRows.length > 0 ? (
            <dd className="flex flex-col gap-1.5 w-full">
              {kpis.inProgressRows.slice(0, 2).map((row) => (
                <div key={row.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-caption text-muted-foreground">
                    <span className="truncate max-w-[130px] font-medium text-foreground">
                      {row.courseName}
                    </span>
                    <span className="tabular-nums text-caption">{row.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, row.progress))}%` }}
                    />
                  </div>
                </div>
              ))}
            </dd>
          ) : (
            <dd className="text-caption text-muted-foreground">
              No courses currently in progress
            </dd>
          )}
        </div>
      </div>

      {/* 4. Expired: Status check or renewal warning */}
      <div className="flex min-h-[160px] flex-col justify-between rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <dt className="text-label uppercase tracking-wider text-muted-foreground">
            Expired
          </dt>
          {kpis.expiredCount > 0 ? (
            <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-4 text-[var(--status-active-fg)]" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <dd
            className={cn(
              "text-kpi font-semibold tabular-nums",
              kpis.expiredCount > 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {kpis.expiredCount}
          </dd>
          <dd className="text-caption flex items-center gap-1.5">
            {kpis.expiredCount === 0 ? (
              <>
                <CheckCircle2 className="size-3.5 text-[var(--status-active-fg)] shrink-0" aria-hidden="true" />
                <span className="font-medium text-[var(--status-active-fg)]">All up to date</span>
              </>
            ) : (
              <>
                <AlertCircle className="size-3.5 text-destructive shrink-0" aria-hidden="true" />
                <span className="font-medium text-destructive">
                  {kpis.expiredCount}{" "}
                  {kpis.expiredCount === 1 ? "certificate needs" : "certificates need"} renewal
                </span>
              </>
            )}
          </dd>
        </div>
      </div>
    </dl>
  );
}
