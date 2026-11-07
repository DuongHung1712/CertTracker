"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBar } from "@/features/dashboard/components/status-bar";
import {
  formatRate,
  ratePercent,
  studyStatusSplit,
  validVsExpiredSplit,
} from "@/features/dashboard/metrics";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";
import { foldText } from "@/lib/text";
import { cn } from "@/lib/utils";

export type TabConfig = {
  id: string;
  label: string;
  groupLabel: string;
  peopleLabel: string;
  rows: BreakdownRow[];
  emptyHint?: string;
};

const rateOf = (row: BreakdownRow): number | null => ratePercent(row.done, row.records);

function ExplorerPane({ tab }: { tab: TabConfig }) {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Sorted by records descending
  const sortedRows = useMemo(() => {
    return [...tab.rows].sort((a, b) => b.records - a.records);
  }, [tab.rows]);

  const filteredRows = useMemo(() => {
    const q = foldText(search);
    if (!q) return sortedRows;
    return sortedRows.filter((r) => foldText(r.label).includes(q));
  }, [sortedRows, search]);

  // Fallback to first row if selected row is absent or filtered out
  const activeKey =
    selectedKey && filteredRows.some((r) => r.key === selectedKey)
      ? selectedKey
      : (filteredRows[0]?.key ?? null);

  const selectedRow = filteredRows.find((r) => r.key === activeKey) ?? null;

  if (tab.rows.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          title="No data yet"
          description={tab.emptyHint ?? "There are no records to count yet."}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12">
      {/* Left pane: search filter and master item list */}
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:col-span-5 lg:border-b-0 lg:border-r">
        {/* Search filter */}
        <div className="relative w-full">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={`Filter ${tab.groupLabel.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8.5 pl-8 text-sm"
            aria-label={`Filter ${tab.groupLabel.toLowerCase()}`}
          />
        </div>

        {/* Header row for list */}
        <div className="flex items-center justify-between px-1 text-label font-medium uppercase text-muted-foreground">
          <span>{tab.groupLabel}</span>
          <span>Records</span>
        </div>

        {/* Master Item List */}
        <div
          role="table"
          aria-label={tab.label}
          className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-0.5"
        >
          {filteredRows.length === 0 ? (
            <div role="row" className="py-8 text-center text-caption text-muted-foreground">
              No matching items found.
            </div>
          ) : (
            filteredRows.map((row) => {
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
                  role="row"
                  tabIndex={0}
                  aria-selected={isSelected}
                  onClick={() => setSelectedKey(row.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedKey(row.key);
                    }
                  }}
                  className={cn(
                    "group relative flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-all outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    isSelected
                      ? "border-primary/50 bg-primary/10 text-foreground font-medium shadow-xs ring-1 ring-primary/25"
                      : "border-border/60 bg-card hover:border-border hover:bg-muted/40 text-foreground",
                  )}
                >
                  {/* Left: Avatar/Monogram + Title + Subtitle */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      aria-hidden
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold tracking-wider",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {initials || "•"}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-body font-medium leading-snug" title={row.label}>
                        {row.label}
                      </span>
                      <span className="truncate text-caption text-muted-foreground">
                        {row.headcount !== null ? `${formatNumber(row.headcount)} headcount · ` : ""}
                        {formatNumber(row.people)} {tab.peopleLabel.toLowerCase()}
                      </span>
                    </div>
                  </div>

                  {/* Right: Record count + Completion % */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-body font-semibold tabular-nums text-foreground">
                      {formatNumber(row.records)}{" "}
                      <span className="text-caption font-normal text-muted-foreground">records</span>
                    </span>
                    <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                      <span
                        className={cn(
                          "inline-block size-1.5 rounded-full",
                          rate === 100
                            ? "bg-[var(--status-active-fg)]"
                            : (rate ?? 0) > 0
                              ? "bg-[var(--chart-1)]"
                              : "bg-muted-foreground",
                        )}
                        aria-hidden
                      />
                      <span className="tabular-nums font-medium text-foreground">
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

      {/* Right pane: detail dossier for selected row */}
      <div className="flex flex-col bg-card/40 p-5 lg:col-span-7">
        {selectedRow ? (
          <section
            role="region"
            aria-label="Selected item details"
            data-testid="explorer-detail-panel"
            className="flex h-full flex-col justify-between gap-5 transition-colors"
          >
            {/* Header: Title + Status + Metadata */}
            <div className="flex flex-col gap-2 border-b border-border pb-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Detail View · {tab.groupLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-caption font-medium text-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      rateOf(selectedRow) === 100
                        ? "bg-[var(--status-active-fg)]"
                        : "bg-[var(--chart-1)]",
                    )}
                    aria-hidden
                  />
                  {formatRate(rateOf(selectedRow))} completed
                </span>
              </div>
              <h3
                className="text-xl font-bold tracking-tight text-foreground truncate"
                title={selectedRow.label}
              >
                {selectedRow.label}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
                <span>
                  {tab.peopleLabel}:{" "}
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

            {/* Middle: 4 Sub-Metric Cards Grid (Matching the template) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Card 1: Valid */}
              <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-background/80 p-3 shadow-xs">
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
                <span className="text-[11px] text-muted-foreground">Active certs</span>
              </div>

              {/* Card 2: Completed */}
              <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-background/80 p-3 shadow-xs">
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
                <span className="text-[11px] text-muted-foreground">100% progress</span>
              </div>

              {/* Card 3: In progress */}
              <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-background/80 p-3 shadow-xs">
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
                <span className="text-[11px] text-muted-foreground">Currently studying</span>
              </div>

              {/* Card 4: Expired */}
              <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-background/80 p-3 shadow-xs">
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
                <span className="text-[11px] text-muted-foreground">Past expiry date</span>
              </div>
            </div>

            {/* Visual Bars */}
            <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-background/50 p-3.5">
              {/* Study status distribution */}
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-medium text-foreground">Study status split</span>
                <StatusBar
                  segments={studyStatusSplit({
                    done: selectedRow.done,
                    inProgress: selectedRow.inProgress,
                    notStarted: selectedRow.notStarted,
                  })}
                  showLabels
                />
              </div>

              {/* Validity split */}
              <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
                <span className="text-caption font-medium text-foreground">Validity split</span>
                <StatusBar
                  segments={validVsExpiredSplit({
                    valid: selectedRow.valid,
                    expired: selectedRow.expired,
                  })}
                  showLabels
                />
              </div>
            </div>

            {/* Bottom Summary Bar (Matching the template) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
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
              </div>
              <Link
                href={`/records?search=${encodeURIComponent(selectedRow.label)}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs")}
              >
                <span>View in records</span>
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </section>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-caption text-muted-foreground">
            Select an item to view its details.
          </div>
        )}
      </div>
    </div>
  );
}

export function Explorer({
  tabs,
  defaultTab,
}: {
  tabs: TabConfig[];
  defaultTab: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        {/* Top Header Tab Strip */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
          <TabsList className="h-9 gap-1.5 bg-muted/60 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-7 rounded-md px-3 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                <span>{tab.label}</span>
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {tab.rows.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab Panels */}
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="m-0 focus-visible:outline-none">
            <section aria-label={tab.label} className="flex min-w-0 flex-col">
              <ExplorerPane tab={tab} />
            </section>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
