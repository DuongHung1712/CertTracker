import { ArrowRight, Hourglass } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Actionable review tile; defaults to completed items waiting for approval, or customised for admin catalogue proposals. */
export function WaitingTile({
  count,
  href = "/records?approval=waiting",
  label = "Waiting for approval",
  summary = "Completed items to check",
  emptySummary = "Nothing to check",
  footer = "Review them",
  className,
}: {
  count: number;
  href?: string;
  label?: string;
  summary?: string;
  emptySummary?: string;
  footer?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/tile flex min-h-[140px] min-w-0 flex-col justify-between rounded-lg border bg-card p-3.5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50",
        count > 0 ? "border-primary/40" : "border-border",
        className,
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="flex items-start justify-between gap-2">
          <span className="font-mono text-label uppercase tracking-wider text-muted-foreground">{label}</span>
          <Hourglass aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </span>
        <span className="mt-1 text-kpi tabular-nums tracking-tight text-foreground">{formatNumber(count)}</span>
        <span className="text-caption text-muted-foreground">{count > 0 ? summary : emptySummary}</span>
      </span>
      <span className="flex items-center justify-between border-t border-border/60 pt-2 text-caption text-muted-foreground">
        <span>{footer}</span>
        <ArrowRight aria-hidden className="size-4 transition-transform group-hover/tile:translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </Link>
  );
}
