import { formatNumber } from "@/lib/format";

export type Stat = readonly [term: string, value: number | undefined];

/** A figure that could not be loaded shows a dash, never a made-up zero. */
const showValue = (value: number | undefined): string => (value === undefined ? "—" : formatNumber(value));

export function StatStrip({ stats }: { stats: readonly Stat[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([term, value]) => (
          <div key={term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="font-mono text-lg font-bold tabular-nums text-foreground">{showValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
