"use client";

import { CheckCircle2 } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import {
  GAUGE_CENTER_Y,
  GAUGE_INNER_RADIUS,
  GAUGE_OUTER_RADIUS,
  GAUGE_SEGMENT_GAP_DEGREES,
  MINI_CHART_BAR_RADIUS,
  MINI_CHART_HEIGHT,
  MINI_CHART_MARGIN,
  MINI_CHART_MAX_BARS,
  MINI_CHART_MIN_BAR_SIZE,
  MINI_CHART_TICK_MAX_CHARS,
  MINI_CHART_TICK_Y_OFFSET,
} from "@/features/dashboard/components/chart-constants";
import { roundedShare, topExpiredGroups, topGroupsWithOthers, truncateLabel } from "@/features/dashboard/metrics";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";

type MiniBar = {
  key: string;
  /** Full name, used by assistive technology. */
  label: string;
  /** Text under the bar. */
  tick: string;
  value: number;
  color: string;
};

/** One bar chart for all hero cards: a value label above each bar, a short label below, a text twin for screen readers. */
function MiniBarChart({
  bars,
  title,
  minBarSize = 0,
}: {
  bars: MiniBar[];
  title: string;
  minBarSize?: number;
}) {
  const summary = bars.map((b) => `${b.label} ${b.value}`).join(", ");

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 [&_.recharts-text]:fill-muted-foreground [&_.recharts-text]:text-caption [&_.recharts-text]:font-sans">
      <div role="img" aria-label={`${title}: ${summary}`} className={`${MINI_CHART_HEIGHT} w-full min-w-0`}>
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={MINI_CHART_MARGIN}>
              <XAxis
                dataKey="tick"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={({ x, y, payload }) => (
                  <text
                    x={x}
                    y={Number(y) + MINI_CHART_TICK_Y_OFFSET}
                    textAnchor="middle"
                    fill="var(--muted-foreground)"
                    className="text-caption font-sans"
                  >
                    {payload.value}
                  </text>
                )}
              />
              <Bar dataKey="value" radius={MINI_CHART_BAR_RADIUS} minPointSize={minBarSize} isAnimationActive={false}>
                {bars.map((bar) => (
                  <Cell key={bar.key} fill={bar.color} />
                ))}
                <LabelList dataKey="value" position="top" fill="var(--foreground)" className="text-caption font-sans font-semibold" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ul className="sr-only">
        {bars.map((b) => (
          <li key={b.key}>{`${b.label}: ${b.value}`}</li>
        ))}
      </ul>
    </div>
  );
}

/** "Certificate records" card: records per group, the biggest groups plus "Others". */
export function RecordsMiniChart({
  rows,
  totalRecords,
}: {
  rows: BreakdownRow[];
  totalRecords?: number;
}) {
  const groups = topGroupsWithOthers(rows, MINI_CHART_MAX_BARS);

  if (groups.length === 0) {
    return (
      <div className={`flex ${MINI_CHART_HEIGHT} items-center justify-center text-center px-2 text-caption text-muted-foreground`}>
        {(totalRecords ?? 0) > 0 ? "Not enough group data to chart" : "No records yet"}
      </div>
    );
  }

  const bars = groups.map((g) => ({
    key: g.label,
    label: g.label,
    tick: truncateLabel(g.label, MINI_CHART_TICK_MAX_CHARS),
    value: g.records,
    color: "var(--chart-1)",
  }));
  return <MiniBarChart bars={bars} title="Certificate records by group" />;
}

const VALID_BUCKET_TICKS: Record<string, string> = {
  active: "> 60d",
  "expiring-60": "31-60d",
  "expiring-soon": "≤ 30d",
  "no-expiry": "No expiry",
};

/** "Valid" card: the four valid buckets (> 60 days, 31–60 days, ≤ 30 days, no expiry) in their status colours. */
export function ValidMiniChart({
  buckets,
}: {
  buckets: { key: string; label: string; count: number; color: string }[];
}) {
  const bars = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    tick: VALID_BUCKET_TICKS[b.key] ?? b.label,
    value: b.count,
    color: b.color,
  }));
  return <MiniBarChart bars={bars} title="Valid certificates" minBarSize={MINI_CHART_MIN_BAR_SIZE} />;
}

/** "Expiring (≤ 60 days)" card: half-donut with the share of completed certificates that expire within 60 days. */
export function ExpiringGaugeMiniChart({
  expiringCount,
  totalCompleted,
}: {
  expiringCount: number;
  totalCompleted: number;
}) {
  const percentage = roundedShare(expiringCount, totalCompleted);
  const otherCount = Math.max(0, totalCompleted - expiringCount);

  const gaugeData = [
    { name: "Expiring (≤ 60d)", value: expiringCount, fill: "var(--status-expiring-soon-fg)" },
    { name: "Remaining valid", value: otherCount, fill: "var(--secondary)" },
  ];

  return (
    <div className={`relative flex flex-col items-center justify-end w-full min-w-0 ${MINI_CHART_HEIGHT}`}>
      <div
        role="img"
        aria-label={`Expiring within 60 days: ${expiringCount} certificates (${percentage}% of completed)`}
        className={`relative ${MINI_CHART_HEIGHT} w-full flex items-center justify-center`}
      >
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={gaugeData}
                dataKey="value"
                cx="50%"
                cy={GAUGE_CENTER_Y}
                startAngle={180}
                endAngle={0}
                innerRadius={GAUGE_INNER_RADIUS}
                outerRadius={GAUGE_OUTER_RADIUS}
                paddingAngle={expiringCount > 0 && otherCount > 0 ? GAUGE_SEGMENT_GAP_DEGREES : 0}
                isAnimationActive={false}
              >
                {gaugeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute bottom-2.5 inset-x-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatNumber(expiringCount)}
          </span>
          <span className="text-caption text-muted-foreground tabular-nums">
            {percentage}% of completed
          </span>
        </div>
      </div>
      <span className="sr-only">
        {`Expiring within 60 days: ${expiringCount} certificates (${percentage}% of completed certificates)`}
      </span>
    </div>
  );
}

/** "Expired" card: a positive empty state when nothing is expired, otherwise expired certificates per group. */
export function ExpiredMiniChart({
  totalExpired,
  rows,
}: {
  totalExpired: number;
  rows: BreakdownRow[];
}) {
  if (totalExpired === 0) {
    return (
      <div
        role="img"
        aria-label="No expired certificates. All completed certificates are up to date."
        className={`flex ${MINI_CHART_HEIGHT} flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/80 bg-muted/20 p-2 text-center`}
      >
        <CheckCircle2 className="size-5 text-[var(--status-active-fg)]" aria-hidden />
        <span className="text-xs font-semibold text-foreground">No expired certificates</span>
        <span className="text-caption text-muted-foreground">All completed certificates are up to date</span>
      </div>
    );
  }

  const bars = topExpiredGroups(rows, MINI_CHART_MAX_BARS).map((r) => ({
    key: r.label,
    label: r.label,
    tick: truncateLabel(r.label, MINI_CHART_TICK_MAX_CHARS),
    value: r.expired,
    color: "var(--status-expired-fg)",
  }));
  return <MiniBarChart bars={bars} title="Expired certificates by group" minBarSize={MINI_CHART_MIN_BAR_SIZE} />;
}
