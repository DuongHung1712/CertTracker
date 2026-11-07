import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const HERO_CARD_MIN_HEIGHT = "min-h-[235px]";

/**
 * Tall Hero KPI card for the Overview row on /dashboard (~220-260px).
 * Conforms to the `dl > div > dt + dd.first()` contract required by e2e assertions.
 * Lower half holds a real mini chart or visual.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  visual,
  valueClassName,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
  visual?: React.ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  const formatted = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors",
        HERO_CARD_MIN_HEIGHT,
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-label uppercase tracking-wider text-muted-foreground">{label}</dt>
          {icon && (
            <div
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground"
            >
              {icon}
            </div>
          )}
        </div>
        <dd className={cn("text-kpi tabular-nums font-semibold tracking-tight text-foreground", valueClassName)}>
          {formatted}
        </dd>
        {hint && <dd className="text-caption text-muted-foreground line-clamp-1">{hint}</dd>}
      </div>
      {visual && <div className="mt-auto pt-2">{visual}</div>}
    </div>
  );
}
