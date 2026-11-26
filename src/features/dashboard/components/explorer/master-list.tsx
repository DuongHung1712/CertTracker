"use client";

import { Button } from "@/components/ui/button";
import { CERTIFICATE_GROUP_LABEL, groupCount } from "@/features/dashboard/components/explorer/types";
import { useListboxNavigation } from "@/features/dashboard/components/explorer/use-listbox-navigation";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";

export function MasterList({
  rows,
  activeKey,
  onSelectKey,
  groupLabel,
  tabLabel,
  onClearFilters,
}: {
  rows: BreakdownRow[];
  activeKey: string | null;
  onSelectKey: (key: string) => void;
  groupLabel: string;
  tabLabel: string;
  onClearFilters: () => void;
}) {
  const { itemRef, onKeyDown } = useListboxNavigation(
    rows.map((row) => row.key),
    activeKey,
    onSelectKey,
  );

  return (
    <div className="flex min-w-0 flex-col gap-2.5 border-b border-border p-4 @2xl:col-span-5 @2xl:border-b-0 @2xl:border-r">
      {/* Header row for list */}
      <div className="flex items-center justify-between px-1 text-label font-medium uppercase text-muted-foreground">
        <span>{groupLabel}</span>
        <span>Total</span>
      </div>

      {rows.length === 0 ? (
        <div role="status" className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
          <p className="text-caption text-muted-foreground">No groups match these filters.</p>
          <Button variant="outline" size="sm" onClick={onClearFilters} className="h-7 text-caption">
            Clear filters
          </Button>
        </div>
      ) : (
        <div
          role="listbox"
          aria-label={tabLabel}
          className="flex flex-col gap-2 overflow-y-auto max-h-72 pr-0.5 @2xl:max-h-[560px]"
        >
          {rows.map((row, index) => {
            const isSelected = row.key === activeKey;
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
                ref={itemRef(row.key)}
                role="option"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                onClick={() => onSelectKey(row.key)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className={cn(
                  "group relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border p-3 cursor-pointer transition-all outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-card hover:border-border hover:bg-muted/40 text-foreground",
                )}
              >
                {/* Left: Monogram + Title + Subtitle */}
                <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
                  <div
                    aria-hidden
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md text-caption font-semibold tracking-wider",
                      isSelected
                        ? "border border-primary-foreground/40 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {initials || "•"}
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        "truncate text-body font-medium leading-snug",
                        isSelected && "font-semibold",
                      )}
                      title={row.label}
                    >
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "truncate text-caption",
                        isSelected ? "text-primary-foreground-muted" : "text-muted-foreground",
                      )}
                      title={
                        row.headcount !== null
                          ? `${pluralize(row.headcount, "member")} · ${row.people} with learning items`
                          : undefined
                      }
                    >
                      {row.headcount !== null
                        ? `${pluralize(row.headcount, "member")} · ${row.people} with learning items`
                        : groupLabel === CERTIFICATE_GROUP_LABEL
                          ? `${row.done} completed`
                          : pluralize(row.people, "member")}
                    </span>
                  </div>
                </div>

                {/* Right: item count */}
                <div className="ml-auto flex shrink-0 items-center">
                  <span
                    className={cn(
                      "text-caption font-semibold tabular-nums",
                      isSelected
                        ? "rounded-sm border border-primary-foreground/40 px-2.5 py-0.5 text-primary-foreground"
                        : "text-body font-semibold text-foreground",
                    )}
                  >
                    {groupCount(row, groupLabel)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
