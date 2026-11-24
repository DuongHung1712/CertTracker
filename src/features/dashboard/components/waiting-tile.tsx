import { ArrowRight, Hourglass } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Completed items nobody has approved yet; the whole tile is a link to /records already filtered to them. */
export function WaitingTile({ count, className }: { count: number; className?: string }) {
  return (
    <Link
      href="/records?approval=waiting"
      className={cn(
        "group/tile flex min-h-[140px] min-w-0 flex-col justify-between rounded-lg border bg-card p-3.5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50",
        count > 0 ? "border-[var(--status-expiring-soon-border)]" : "border-border",
        className,
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="flex items-start justify-between gap-2">
          <span className="font-mono text-label uppercase tracking-wider text-muted-foreground">Waiting for approval</span>
          <Hourglass aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </span>
        <span className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">{count}</span>
        <span className="text-caption text-muted-foreground">{count > 0 ? "Completed items to check" : "Nothing to check"}</span>
      </span>
      <span className="flex items-center justify-between border-t border-border/60 pt-2 text-caption text-muted-foreground">
        <span>Review them</span>
        <ArrowRight aria-hidden className="size-4 transition-transform group-hover/tile:translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </Link>
  );
}
