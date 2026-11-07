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
import type { BreakdownRow } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";

/**
 * 1. Mini BarChart for "Certificate records" card.
 * Shows records per team (or cert type), top 6 bars + "Others" grouped.
 * Fill uses --chart-1, visible value labels, no animation.
 */
export function RecordsMiniChart({
  rows,
  totalRecords,
}: {
  rows: BreakdownRow[];
  totalRecords?: number;
}) {
  const sorted = [...rows].sort((a, b) => b.records - a.records);
  const top6 = sorted.slice(0, 6);
  const remaining = sorted.slice(6);
  const othersSum = remaining.reduce((sum, r) => sum + r.records, 0);

  const data = othersSum > 0
    ? [...top6.map((r) => ({ label: r.label, records: r.records })), { label: "Others", records: othersSum }]
    : top6.map((r) => ({ label: r.label, records: r.records }));

  if (data.length === 0) {
    return (
      <div className="flex h-20 sm:h-24 items-center justify-center text-center px-2 text-caption text-muted-foreground">
        {(totalRecords ?? 0) > 0 ? "Not enough group data to chart" : "No records yet"}
      </div>
    );
  }

  const summary = data.map((d) => `${d.label} ${d.records}`).join(", ");

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 [&_.recharts-text]:fill-muted-foreground [&_.recharts-text]:text-caption [&_.recharts-text]:font-sans">
      <div role="img" aria-label={`Certificate records by group: ${summary}`} className="h-20 sm:h-24 w-full min-w-0">
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 14, right: 2, bottom: 0, left: 2 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={({ x, y, payload }) => {
                  const text = String(payload.value || "");
                  const truncated = text.length > 7 ? `${text.slice(0, 6)}…` : text;
                  return (
                    <text x={x} y={Number(y) + 8} textAnchor="middle" fill="var(--muted-foreground)" className="text-caption font-sans">
                      {truncated}
                    </text>
                  );
                }}
              />
              <Bar dataKey="records" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="records" position="top" fill="var(--foreground)" className="text-caption font-sans font-semibold" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.label}>{`${d.label}: ${d.records}`}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 2. Mini BarChart for "Valid" card.
 * Shows the four valid buckets (> 60 days, 31–60 days, ≤ 30 days, No expiry)
 * using the existing --status-* tokens.
 */
export function ValidMiniChart({
  buckets,
}: {
  buckets: { key: string; label: string; count: number; color: string }[];
}) {
  const summary = buckets.map((b) => `${b.label} ${b.count}`).join(", ");

  // Short labels for axis mapped from real metrics.ts bucket keys
  const shortLabels: Record<string, string> = {
    active: "> 60d",
    "expiring-60": "31-60d",
    "expiring-soon": "≤ 30d",
    "no-expiry": "No expiry",
  };

  const chartData = buckets.map((b) => ({
    ...b,
    shortLabel: shortLabels[b.key] ?? b.label,
  }));

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 [&_.recharts-text]:fill-muted-foreground [&_.recharts-text]:text-caption [&_.recharts-text]:font-sans">
      <div role="img" aria-label={`Valid certificates: ${summary}`} className="h-20 sm:h-24 w-full min-w-0">
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 14, right: 2, bottom: 0, left: 2 }}>
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={({ x, y, payload }) => (
                  <text x={x} y={Number(y) + 8} textAnchor="middle" fill="var(--muted-foreground)" className="text-caption font-sans">
                    {payload.value}
                  </text>
                )}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} minPointSize={3} isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
                <LabelList dataKey="count" position="top" fill="var(--foreground)" className="text-caption font-sans font-semibold" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ul className="sr-only">
        {chartData.map((d) => (
          <li key={d.key}>{`${d.label}: ${d.count}`}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 3. Mini Half-Donut Gauge for "Expiring (≤ 60 days)" card.
 * Shows share of completed certificates expiring within 60 days.
 * Number and percentage in the centre.
 */
export function ExpiringGaugeMiniChart({
  expiringCount,
  totalCompleted,
}: {
  expiringCount: number;
  totalCompleted: number;
}) {
  const percentage = totalCompleted > 0 ? Math.round((expiringCount / totalCompleted) * 100) : 0;
  const otherCount = Math.max(0, totalCompleted - expiringCount);

  const gaugeData = [
    { name: "Expiring (≤ 60d)", value: expiringCount, fill: "var(--status-expiring-soon-fg)" },
    { name: "Remaining valid", value: otherCount, fill: "var(--secondary)" },
  ];

  return (
    <div className="relative flex flex-col items-center justify-end w-full min-w-0 h-20 sm:h-24">
      <div
        role="img"
        aria-label={`Expiring within 60 days: ${expiringCount} certificates (${percentage}% of completed)`}
        className="relative h-20 sm:h-24 w-full flex items-center justify-center"
      >
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={gaugeData}
                dataKey="value"
                cx="50%"
                cy="85%"
                startAngle={180}
                endAngle={0}
                innerRadius="70%"
                outerRadius="100%"
                paddingAngle={expiringCount > 0 && otherCount > 0 ? 3 : 0}
                isAnimationActive={false}
              >
                {gaugeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Center count and percentage */}
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

/**
 * 4. Mini BarChart or positive empty state for "Expired" card.
 * When total is 0, shows positive empty state (check icon, "No expired certificates").
 * When > 0, shows BarChart of expired certificates per team/type.
 */
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
        className="flex h-20 sm:h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/80 bg-muted/20 p-2 text-center"
      >
        <CheckCircle2 className="size-5 text-[var(--status-active-fg)]" aria-hidden />
        <span className="text-xs font-semibold text-foreground">No expired certificates</span>
        <span className="text-caption text-muted-foreground">All completed certificates are up to date</span>
      </div>
    );
  }

  // If expired > 0, show BarChart of groups with expired certificates
  const expiredRows = rows
    .filter((r) => r.expired > 0)
    .sort((a, b) => b.expired - a.expired)
    .slice(0, 6);

  const summary = expiredRows.map((r) => `${r.label} ${r.expired}`).join(", ");

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 [&_.recharts-text]:fill-muted-foreground [&_.recharts-text]:text-caption [&_.recharts-text]:font-sans">
      <div role="img" aria-label={`Expired certificates by group: ${summary}`} className="h-20 sm:h-24 w-full min-w-0">
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expiredRows} margin={{ top: 14, right: 2, bottom: 0, left: 2 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={({ x, y, payload }) => {
                  const text = String(payload.value || "");
                  const truncated = text.length > 7 ? `${text.slice(0, 6)}…` : text;
                  return (
                    <text x={x} y={Number(y) + 8} textAnchor="middle" fill="var(--muted-foreground)" className="text-caption font-sans">
                      {truncated}
                    </text>
                  );
                }}
              />
              <Bar dataKey="expired" fill="var(--status-expired-fg)" radius={[3, 3, 0, 0]} minPointSize={3} isAnimationActive={false}>
                <LabelList dataKey="expired" position="top" fill="var(--foreground)" className="text-caption font-sans font-semibold" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ul className="sr-only">
        {expiredRows.map((d) => (
          <li key={d.label}>{`${d.label}: ${d.expired}`}</li>
        ))}
      </ul>
    </div>
  );
}
