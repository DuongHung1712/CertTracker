import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { expiringCerts, validCerts } from "@/features/dashboard/metrics";
import type { DashboardKpis } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";

export function DepartmentSummaryCard({ kpis }: { kpis: DashboardKpis }) {
  const valid = validCerts(kpis);
  const expiring = expiringCerts(kpis);
  const expired = kpis.expiredCerts;

  return (
    <section
      aria-label="Across the department"
      className="flex flex-col gap-3.5 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold text-foreground">Across the department</h3>
        <span className="text-caption text-muted-foreground">Totals only, no names</span>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-border rounded-md border border-border bg-background/50 text-center">
        <div className="flex flex-col gap-0.5 p-2.5">
          <dt className="text-caption text-muted-foreground flex items-center justify-center gap-1">
            <CheckCircle2 className="size-3 text-[var(--status-active-fg)]" aria-hidden="true" />
            <span>Valid</span>
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {formatNumber(valid)}
          </dd>
        </div>

        <div className="flex flex-col gap-0.5 p-2.5">
          <dt className="text-caption text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="size-3 text-[var(--status-expiring-soon-fg)]" aria-hidden="true" />
            <span>Expiring within 60 days</span>
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {formatNumber(expiring)}
          </dd>
        </div>

        <div className="flex flex-col gap-0.5 p-2.5">
          <dt className="text-caption text-muted-foreground flex items-center justify-center gap-1">
            <AlertCircle className="size-3 text-destructive" aria-hidden="true" />
            <span>Expired</span>
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {formatNumber(expired)}
          </dd>
        </div>
      </dl>

      <p className="text-caption text-muted-foreground">
        Totals for the whole department.
      </p>
    </section>
  );
}
