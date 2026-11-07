"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBar } from "@/features/dashboard/components/status-bar";
import { rateOf } from "@/features/dashboard/components/explorer/types";
import {
  formatRate,
  studyStatusSplit,
  validVsExpiredSplit,
} from "@/features/dashboard/metrics";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DetailPanel({
  selectedRow,
  groupLabel,
  peopleLabel,
}: {
  selectedRow: BreakdownRow | null;
  groupLabel: string;
  peopleLabel: string;
}) {
  async function handleCopySummary(row: BreakdownRow) {
    const rate = rateOf(row);
    const summaryText = `${row.label}: ${row.records} records, ${formatRate(rate)} completed (${row.done} done, ${row.inProgress} in progress, ${row.valid} valid, ${row.expired} expired).`;
    try {
      await navigator.clipboard.writeText(summaryText);
      toast.success("Copied summary to clipboard");
    } catch {
      toast.error("Failed to copy summary");
    }
  }

  return (
    <div className="flex flex-col bg-card/40 p-5 lg:col-span-7">
      {selectedRow ? (
        <section
          role="region"
          aria-label="Selected item details"
          data-testid="explorer-detail-panel"
          className="flex h-full flex-col justify-between gap-5 transition-colors"
        >
          {/* Header: Title + Status Pill + Metadata */}
          <div className="flex flex-col gap-2 border-b border-border pb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label font-medium uppercase tracking-wider text-muted-foreground">
                Detail View · {groupLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-caption font-medium text-foreground">
                <span
                  className="size-1.5 rounded-full bg-[var(--chart-1)]"
                  aria-hidden
                />
                {formatRate(rateOf(selectedRow))} completed
              </span>
            </div>
            <h3
              className="text-page-title font-bold tracking-tight text-foreground truncate"
              title={selectedRow.label}
            >
              {selectedRow.label}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
              <span>
                {peopleLabel}:{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {formatNumber(selectedRow.headcount ?? selectedRow.people)}
                </strong>
              </span>
              <span>•</span>
              <span>
                Total records:{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {formatNumber(selectedRow.records)}
                </strong>
              </span>
            </div>
          </div>

          {/* Middle: 4 Sub-Metric Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Card 1: Valid */}
            <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-background/80 p-3">
              <div className="flex items-center justify-between text-caption text-muted-foreground">
                <span>Valid</span>
                <span className="size-2 rounded-full bg-[var(--status-active-fg)]" aria-hidden />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {formatNumber(selectedRow.valid)}
                </span>
                <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              <span className="text-caption text-muted-foreground">Active certs</span>
            </div>

            {/* Card 2: Completed */}
            <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-background/80 p-3">
              <div className="flex items-center justify-between text-caption text-muted-foreground">
                <span>Completed</span>
                <span className="size-2 rounded-full bg-[var(--chart-1)]" aria-hidden />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {formatNumber(selectedRow.done)}
                </span>
                <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              <span className="text-caption text-muted-foreground">100% progress</span>
            </div>

            {/* Card 3: In progress */}
            <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-background/80 p-3">
              <div className="flex items-center justify-between text-caption text-muted-foreground">
                <span>In progress</span>
                <span className="size-2 rounded-full bg-[var(--chart-2)]" aria-hidden />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {formatNumber(selectedRow.inProgress)}
                </span>
                <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              <span className="text-caption text-muted-foreground">Currently studying</span>
            </div>

            {/* Card 4: Expired */}
            <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-background/80 p-3">
              <div className="flex items-center justify-between text-caption text-muted-foreground">
                <span>Expired</span>
                <span className="size-2 rounded-full bg-[var(--status-expired-fg)]" aria-hidden />
              </div>
              <div className="flex items-baseline justify-between">
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    selectedRow.expired > 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatNumber(selectedRow.expired)}
                </span>
                <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              <span className="text-caption text-muted-foreground">Past expiry date</span>
            </div>
          </div>

          {/* Visual Bars (Folded Study Status Split & Validity Split) */}
          <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-background/50 p-3.5">
            {/* Study status distribution */}
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-medium text-foreground">Study status split</span>
              <div
                role="img"
                aria-label={`Study completion: ${formatRate(rateOf(selectedRow))} completed. Completed: ${selectedRow.done}, In progress: ${selectedRow.inProgress}, Not started: ${selectedRow.notStarted}`}
              >
                <StatusBar
                  segments={studyStatusSplit({
                    done: selectedRow.done,
                    inProgress: selectedRow.inProgress,
                    notStarted: selectedRow.notStarted,
                  })}
                  showLabels
                />
              </div>
            </div>

            {/* Validity split */}
            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
              <span className="text-caption font-medium text-foreground">Validity split</span>
              <div
                role="img"
                aria-label={`Validity split: Valid ${selectedRow.valid}, Expired ${selectedRow.expired}`}
              >
                <StatusBar
                  segments={validVsExpiredSplit({
                    valid: selectedRow.valid,
                    expired: selectedRow.expired,
                  })}
                  showLabels
                />
              </div>
            </div>
          </div>

          {/* Totals Footer matching the template */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            {/* Left: 3 figures */}
            <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
              <span>
                Total:{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {formatNumber(selectedRow.records)}
                </strong>{" "}
                records
              </span>
              <span>•</span>
              <span>
                Completion:{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {formatRate(rateOf(selectedRow))}
                </strong>
              </span>
              <span>•</span>
              <span>
                Expired:{" "}
                <strong
                  className={cn(
                    "font-semibold tabular-nums",
                    selectedRow.expired > 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatNumber(selectedRow.expired)}
                </strong>
              </span>
            </div>

            {/* Right: 2 Icon action buttons with Tooltip + Primary View in records button */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() => handleCopySummary(selectedRow)}
                      aria-label="Copy summary"
                    >
                      <Copy className="size-4" aria-hidden />
                    </Button>
                  }
                />
                <TooltipContent>Copy summary</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href={`/records?search=${encodeURIComponent(selectedRow.label)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "size-8 p-0",
                      )}
                      aria-label="Open records in new tab"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </Link>
                  }
                />
                <TooltipContent>Open records in new tab</TooltipContent>
              </Tooltip>

              <Link
                href={`/records?search=${encodeURIComponent(selectedRow.label)}`}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "h-8 gap-1.5 text-xs font-medium",
                )}
              >
                <span>View in records</span>
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-caption text-muted-foreground">
          Select an item to view its details.
        </div>
      )}
    </div>
  );
}
