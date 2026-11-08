"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatRate, ratePercent } from "@/features/dashboard/metrics";
import { formatNumber } from "@/lib/format";

type CompletionCounts = {
  done: number;
  inProgress: number;
  notStarted: number;
};

/**
 * Health row Donut chart showing study status breakdown (Completed / In progress / Not started).
 * Uses --chart-1, --chart-2, --chart-3 tokens with WCAG >= 3:1 contrast against card in light and dark.
 * Animation is disabled and full screen-reader text equivalent is provided.
 */
export function CompletionDonut({ counts }: { counts: CompletionCounts }) {
  const total = counts.done + counts.inProgress + counts.notStarted;
  const rate = ratePercent(counts.done, total);

  if (total === 0) {
    return <p className="text-body text-muted-foreground">No certificates yet.</p>;
  }

  const segments = [
    { name: "Completed", value: counts.done, color: "var(--chart-1)" },
    { name: "In progress", value: counts.inProgress, color: "var(--chart-2)" },
    { name: "Not started", value: counts.notStarted, color: "var(--chart-3)" },
  ];

  // If a slice has 0 value, Pie doesn't render it. Filter only for Pie rendering.
  const pieData = segments.filter((s) => s.value > 0);
  const summary = segments
    .map((s) => `${s.name}: ${s.value} (${total > 0 ? Math.round((s.value / total) * 100) : 0}%)`)
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={`Study completion: ${formatRate(rate)} completed. ${summary}`}
        className="relative flex h-48 w-full items-center justify-center"
      >
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={pieData.length > 1 ? 2 : 0}
                isAnimationActive={false}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Centre rate indicator */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-kpi font-semibold tabular-nums text-foreground">
            {formatRate(rate)}
          </span>
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            completed
          </span>
        </div>
      </div>

      {/* Legend with numbers and labels beside every segment */}
      <ul className="flex flex-col gap-2 border-t border-border pt-3 text-table">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <li key={seg.name} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden
                />
                <span className="text-foreground">{seg.name}</span>
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(seg.value)}
                <span className="ml-1 text-caption text-muted-foreground font-normal">
                  ({pct}%)
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <ul className="sr-only">
        {segments.map((seg) => (
          <li key={seg.name}>{`${seg.name}: ${seg.value}`}</li>
        ))}
      </ul>
    </div>
  );
}
