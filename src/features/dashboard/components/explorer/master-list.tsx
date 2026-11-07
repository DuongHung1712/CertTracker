"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { rateOf } from "@/features/dashboard/components/explorer/types";
import { formatRate } from "@/features/dashboard/metrics";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MasterList({
  rows,
  activeKey,
  onSelectKey,
  groupLabel,
  peopleLabel,
  tabLabel,
  onClearFilters,
}: {
  rows: BreakdownRow[];
  activeKey: string | null;
  onSelectKey: (key: string) => void;
  groupLabel: string;
  peopleLabel: string;
  tabLabel: string;
  onClearFilters: () => void;
}) {
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Focus active item when activeKey changes via keyboard navigation
  useEffect(() => {
    if (activeKey) {
      const el = itemRefs.current.get(activeKey);
      if (el && document.activeElement && el.parentElement?.contains(document.activeElement)) {
        el.focus();
      }
    }
  }, [activeKey]);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (rows.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = Math.min(index + 1, rows.length - 1);
      const nextKey = rows[nextIndex]?.key;
      if (nextKey) {
        onSelectKey(nextKey);
        itemRefs.current.get(nextKey)?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = Math.max(index - 1, 0);
      const prevKey = rows[prevIndex]?.key;
      if (prevKey) {
        onSelectKey(prevKey);
        itemRefs.current.get(prevKey)?.focus();
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      const firstKey = rows[0]?.key;
      if (firstKey) {
        onSelectKey(firstKey);
        itemRefs.current.get(firstKey)?.focus();
      }
    } else if (e.key === "End") {
      e.preventDefault();
      const lastKey = rows[rows.length - 1]?.key;
      if (lastKey) {
        onSelectKey(lastKey);
        itemRefs.current.get(lastKey)?.focus();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const key = rows[index]?.key;
      if (key) onSelectKey(key);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 border-b border-border p-4 lg:col-span-5 lg:border-b-0 lg:border-r">
      {/* Header row for list */}
      <div className="flex items-center justify-between px-1 text-label font-medium uppercase text-muted-foreground">
        <span>{groupLabel}</span>
        <span>Records</span>
      </div>

      {/* Master Item List */}
      <div
        role="listbox"
        aria-label={tabLabel}
        className="flex flex-col gap-2 overflow-y-auto max-h-[560px] pr-0.5"
      >
        {rows.length === 0 ? (
          <div
            role="option"
            aria-selected={false}
            className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center"
          >
            <p className="text-caption text-muted-foreground">No matching items found.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-7 text-xs"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          rows.map((row, index) => {
            const isSelected = row.key === activeKey;
            const rate = rateOf(row);
            const initials = row.label
              .split(" ")
              .filter(Boolean)
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div
                key={row.key}
                ref={(el) => {
                  if (el) itemRefs.current.set(row.key, el);
                  else itemRefs.current.delete(row.key);
                }}
                role="option"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                onClick={() => onSelectKey(row.key)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={cn(
                  "group relative flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-all outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-card",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border-border/60 bg-card hover:border-border hover:bg-muted/40 text-foreground",
                )}
              >
                {/* Left: Monogram + Title + Subtitle */}
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    aria-hidden
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md text-caption font-semibold tracking-wider",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {initials || "•"}
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        "truncate text-body font-medium leading-snug",
                        isSelected ? "text-primary-foreground font-semibold" : "text-foreground",
                      )}
                      title={row.label}
                    >
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "truncate text-caption",
                        isSelected ? "text-[var(--primary-foreground-muted)]" : "text-muted-foreground",
                      )}
                    >
                      {row.headcount !== null ? `${formatNumber(row.headcount)} headcount · ` : ""}
                      {formatNumber(row.people)} {peopleLabel.toLowerCase()}
                    </span>
                  </div>
                </div>

                {/* Right: Record count chip + Completion % */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      isSelected
                        ? "rounded-full bg-primary-foreground/20 px-2.5 py-0.5 text-primary-foreground"
                        : "text-body font-semibold text-foreground",
                    )}
                  >
                    {formatNumber(row.records)}{" "}
                    <span
                      className={cn(
                        "font-normal",
                        isSelected ? "text-[var(--primary-foreground-muted)]" : "text-caption text-muted-foreground",
                      )}
                    >
                      records
                    </span>
                  </span>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-caption",
                      isSelected ? "text-primary-foreground font-medium" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block size-1.5 rounded-full",
                        isSelected
                          ? "bg-primary-foreground"
                          : (rate ?? 0) > 0
                            ? "bg-[var(--chart-1)]"
                            : "bg-muted-foreground",
                      )}
                      aria-hidden
                    />
                    <span className="tabular-nums font-medium">
                      {formatRate(rate)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
