import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const BORDER = {
  neutral: "border-border",
  warning: "border-[var(--status-expiring-soon-border)]",
  danger: "border-[var(--status-expired-border)]",
} as const;

export type SummaryTone = keyof typeof BORDER;

/**
 * One headline number for the manager and admin dashboards (the member's tiles are links of their own): a label, the
 * figure, one line that explains it and one line under a rule. Same frame as `WaitingTile`, so the four tiles read as one row.
 */
export function SummaryTile({
  label,
  value,
  summary,
  footer,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  summary: string;
  footer: ReactNode;
  tone?: SummaryTone;
}) {
  return (
    <div data-slot="kpi-tile" className={cn("flex min-h-[140px] min-w-0 flex-col justify-between rounded-lg border bg-card p-3.5", BORDER[tone])}>
      <dl className="flex flex-col gap-1">
        <dt className="font-mono text-label uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl", tone === "danger" ? "text-status-expired-fg" : "text-foreground")}>
          {value}
        </dd>
        <dd className="text-caption text-muted-foreground">{summary}</dd>
      </dl>
      <div className="border-t border-border/60 pt-2 text-caption text-muted-foreground">{footer}</div>
    </div>
  );
}
