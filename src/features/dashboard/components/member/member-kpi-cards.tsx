import { AlertCircle, Award, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import type { MemberKpis } from "@/features/dashboard/member-metrics";
import { cn } from "@/lib/utils";

export function MemberKpiCards({ kpis }: { kpis: MemberKpis }) {
  const compliancePct =
    kpis.total > 0 ? Math.round((kpis.validCount / kpis.total) * 100) : 100;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3">
      {/* 1. Recorded certificates: Dossier Ledger in solid primary teal */}
      <div className="flex min-h-[175px] flex-col justify-between rounded-lg border border-transparent bg-primary p-3.5 text-primary-foreground shadow-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase tracking-wider text-primary-foreground/80 font-mono text-[10px] sm:text-[11px]">
              Recorded certificates
            </dt>
            <Award className="size-3.5 text-primary-foreground/80 shrink-0" aria-hidden="true" />
          </div>
          <dd className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-primary-foreground mt-1">
            {kpis.total}
          </dd>
          <dd className="text-[11px] text-primary-foreground/80 leading-tight">
            Recorded credentials
          </dd>
        </div>

        <div className="border-t border-primary-foreground/20 pt-2 flex flex-col gap-1.5">
          <div className="inline-flex items-center self-start rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            {compliancePct}% Compliant · {kpis.validCount}/{kpis.total} active
          </div>
          <div className="flex items-center gap-1 text-[9px] font-mono text-primary-foreground/90">
            <span className="rounded bg-white/10 px-1 py-0.5">{kpis.validCount} valid</span>
            <span className="rounded bg-white/10 px-1 py-0.5">{kpis.expiringCount} exp</span>
            <span className="rounded bg-white/10 px-1 py-0.5">{kpis.inProgressCount} study</span>
          </div>
        </div>
      </div>

      {/* 2. Expiring soon: amber border and warning accent */}
      <div
        className={cn(
          "flex min-h-[175px] flex-col justify-between rounded-lg border p-3.5 bg-card",
          kpis.expiringCount > 0
            ? "border-[var(--status-expiring-soon-border)]"
            : "border-border",
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt
              className={cn(
                "text-label uppercase tracking-wider font-mono text-[10px] sm:text-[11px]",
                kpis.expiringCount > 0
                  ? "text-[var(--status-expiring-soon-fg)]"
                  : "text-muted-foreground",
              )}
            >
              Expiring soon
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
          <dd className="text-[11px] text-muted-foreground leading-tight">
            ≤ 60 days left
          </dd>
        </div>

        <div className="border-t border-border pt-2 flex flex-col gap-0.5 text-[11px]">
          {kpis.leastDaysRecord ? (
            <>
              <span className="font-medium text-foreground truncate max-w-full" title={kpis.leastDaysRecord.courseName}>
                Target: {kpis.leastDaysRecord.courseName}
              </span>
              <span className="font-mono text-[10px] font-semibold text-[var(--status-expiring-soon-fg)]">
                {kpis.leastDaysRecord.daysToExpiry} days left
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-[10px]">All up to date</span>
          )}
        </div>
      </div>

      {/* 3. In progress: active study goals */}
      <div className="flex min-h-[175px] flex-col justify-between rounded-lg border border-border bg-card p-3.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase tracking-wider font-mono text-[10px] sm:text-[11px] text-muted-foreground">
              In progress
            </dt>
            <PlayCircle className="size-3.5 text-primary shrink-0" aria-hidden="true" />
          </div>
          <dd className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-foreground mt-1">
            {kpis.inProgressCount}
          </dd>
          <dd className="text-[11px] text-muted-foreground leading-tight">
            Active study goals
          </dd>
        </div>

        <div className="border-t border-border pt-2 flex flex-col gap-1 text-[10px]">
          {kpis.inProgressRows.length > 0 ? (
            kpis.inProgressRows.slice(0, 2).map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded bg-muted/50 px-1.5 py-0.5 font-mono"
              >
                <span className="truncate max-w-[90px] font-medium text-foreground">
                  {row.courseName}
                </span>
                <span className="font-semibold text-foreground">{row.progress}%</span>
              </div>
            ))
          ) : (
            <span className="text-muted-foreground text-[10px]">No active study goals</span>
          )}
        </div>
      </div>

      {/* 4. Expired: status check and compliance note */}
      <div className="flex min-h-[175px] flex-col justify-between rounded-lg border border-border bg-card p-3.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase tracking-wider font-mono text-[10px] sm:text-[11px] text-muted-foreground">
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
          <dd className="text-[11px] text-muted-foreground leading-tight">
            {kpis.expiredCount === 0 ? "All up to date" : "Needs renewal"}
          </dd>
        </div>

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground leading-tight">
          {kpis.expiredCount === 0
            ? "Audit compliance OK. Zero registry violations."
            : `${kpis.expiredCount} certificates need renewal.`}
        </div>
      </div>
    </dl>
  );
}
