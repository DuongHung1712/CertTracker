import { formatNumber } from "@/lib/format";

/** One KPI. Render inside a `<dl>`; `hint` is a second line of context (e.g. "trong đó 3 sắp hết hạn"). */
export function KpiTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-4">
      <dt className="text-label uppercase text-muted-foreground">{label}</dt>
      <dd className="text-kpi tabular-nums text-foreground">{typeof value === "number" ? formatNumber(value) : value}</dd>
      {hint && <dd className="text-caption text-muted-foreground">{hint}</dd>}
    </div>
  );
}
