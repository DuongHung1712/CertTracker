"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Rectangle,
  ResponsiveContainer,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import { expiryMeta } from "@/components/status/expiry";
import type { ExpiryBucket } from "@/features/dashboard/metrics";
import { formatNumber } from "@/lib/format";

/**
 * Horizontal bars, one per expiry bucket: the label is on the axis and the count at the bar end, so colour is never
 * the only carrier. Fill is the `--status-<tone>-fg` token (design-system 2.5). Recharts text is styled through the
 * wrapper's token classes; the SVG is hidden from assistive tech and replaced by `aria-label` + an `sr-only` list.
 */
export function ExpiryChart({ buckets }: { buckets: ExpiryBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total === 0) return <p className="text-body text-muted-foreground">Chưa có chứng chỉ nào đã hoàn thành.</p>;

  const summary = buckets.map((bucket) => `${bucket.label} ${bucket.count}`).join(", ");
  return (
    <div className="min-w-0 [&_.recharts-text]:fill-foreground [&_.recharts-text]:text-table">
      <div role="img" aria-label={`Hạn chứng chỉ: ${summary}`} className="h-56 min-w-0">
        <div aria-hidden className="h-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buckets}
              layout="vertical"
              accessibilityLayer={false}
              margin={{ top: 4, right: 36, bottom: 4, left: 0 }}
            >
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={168} tickLine={false} axisLine={false} interval={0} />
              {/*
                A custom `shape` makes Recharts keep zero-width bars; without it a bucket with 0 certificates is
                dropped together with its end label, and "0" would be the one number missing from the chart.
              */}
              <Bar dataKey="count" radius={4} isAnimationActive={false} shape={(props: BarShapeProps) => <Rectangle {...props} />}>
                {buckets.map((bucket) => (
                  <Cell key={bucket.status} fill={`var(--status-${expiryMeta(bucket.status).tone}-fg)`} />
                ))}
                <LabelList dataKey="count" position="right" formatter={(value: unknown) => formatNumber(Number(value))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Outside role="img": the descendants of an image are presentational, so a list inside it would not be exposed. */}
      <ul className="sr-only">
        {buckets.map((bucket) => (
          <li key={bucket.status}>{`${bucket.label}: ${bucket.count}`}</li>
        ))}
      </ul>
    </div>
  );
}
