import { formatNumber } from "@/lib/format";

/** One KPI. Render inside a `<dl>`; `hint` is a second line of context (e.g. "3 of them expiring soon"). */
export function KpiTile({
  label,
  value,
  hint,
  verified,
}: {
  label: string;
  value: number | string;
  hint?: string;
  verified?: boolean;
}) {
  const isVerified =
    verified ??
    (label.toLowerCase().includes("valid") ||
      label.toLowerCase().includes("completion"));
  return (
    <div
      data-slot="kpi-tile"
      data-verified={isVerified ? "true" : undefined}
      className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors"
    >
      <dt className="text-label uppercase text-muted-foreground">{label}</dt>
      <dd className="text-kpi tabular-nums text-foreground tracking-tight">{typeof value === "number" ? formatNumber(value) : value}</dd>
      {hint && <dd className="text-caption text-muted-foreground">{hint}</dd>}
    </div>
  );
}
