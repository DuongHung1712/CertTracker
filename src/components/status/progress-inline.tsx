import { formatPercent } from "@/lib/format";
import { clampPercent } from "@/components/status/labels";

export function ProgressInline({ value }: { value: number }) {
  const percent = clampPercent(value);
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label="Tiến độ học"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 w-16 overflow-hidden rounded-sm bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-9 text-right text-table tabular-nums text-muted-foreground">{formatPercent(percent)}</span>
    </div>
  );
}
