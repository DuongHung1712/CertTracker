import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Hero KPI card for the Overview row on /dashboard.
 * Conforms to the `dl > div > dt + dd.first()` contract required by e2e assertions.
 */
export function KpiCard({
  label,
  value,
  hint,
  visual,
  valueClassName,
}: {
  label: string;
  value: number | string;
  hint?: string;
  visual?: React.ReactNode;
  valueClassName?: string;
}) {
  const formatted = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors">
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-label uppercase text-muted-foreground">{label}</dt>
        <dd className={cn("text-kpi tabular-nums tracking-tight text-foreground", valueClassName)}>
          {formatted}
        </dd>
        {hint && <dd className="text-caption text-muted-foreground">{hint}</dd>}
      </div>
      {visual && <div className="mt-auto pt-1">{visual}</div>}
    </div>
  );
}
