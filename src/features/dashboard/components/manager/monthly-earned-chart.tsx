"use client";

import { Award } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import {
  MINI_CHART_BAR_RADIUS,
  MINI_CHART_MARGIN,
} from "@/features/dashboard/components/chart-constants";
import { getCertificatesEarnedByMonth } from "@/features/dashboard/manager-metrics";
import type { RecordRow } from "@/features/records/queries";
import { pluralize } from "@/lib/plural";

export function MonthlyEarnedChart({ records }: { records: RecordRow[] }) {
  const months = getCertificatesEarnedByMonth(records, 6);
  const totalEarned = months.reduce((acc, m) => acc + m.count, 0);

  const firstMonth = months[0]?.label ?? "Jan";
  const lastMonth = months[months.length - 1]?.label ?? "Jun";
  const summary = months.map((m) => `${m.label}: ${pluralize(m.count, "certificate")}`).join(", ");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground truncate">
          Certificates earned ({firstMonth} - {lastMonth})
        </span>
        <Award className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
      </div>

      <div
        role="img"
        aria-label={`Certificates earned by month: ${summary}`}
        className="h-[120px] w-full min-w-0 [&_.recharts-text]:fill-muted-foreground [&_.recharts-text]:text-caption [&_.recharts-text]:font-sans"
      >
        <div aria-hidden="true" className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={MINI_CHART_MARGIN}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                height={20}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Bar dataKey="count" radius={MINI_CHART_BAR_RADIUS} isAnimationActive={false}>
                <LabelList
                  dataKey="count"
                  position="top"
                  formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")}
                  className="fill-foreground text-caption font-semibold"
                />
                {months.map((entry) => (
                  <Cell
                    key={entry.monthKey}
                    fill={entry.isPeak ? "var(--primary)" : "var(--primary)/30"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 text-caption">
        <span className="text-muted-foreground">
          Total earned: <strong className="font-semibold text-foreground font-mono">{pluralize(totalEarned, "certificate")}</strong>
        </span>
        <span className="font-mono text-caption text-primary font-medium">+28%</span>
      </div>

      <span className="sr-only">{`Certificates earned by month: ${summary}`}</span>
    </div>
  );
}
