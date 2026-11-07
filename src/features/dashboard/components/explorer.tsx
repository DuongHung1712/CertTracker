"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Copy, ExternalLink, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/data/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

export function Explorer({
  tabs,
  defaultTab,
}: {
  tabs: TabConfig[];
  defaultTab: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [minRecordsFilter, setMinRecordsFilter] = useState<string>("0");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  // Active filters count
  const activeFilterCount =
    (search.trim().length > 0 ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (minRecordsFilter !== "0" ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setMinRecordsFilter("0");
  }

  // Sorted by records descending
  const sortedRows = useMemo(() => {
    if (!currentTab) return [];
    return [...currentTab.rows].sort((a, b) => b.records - a.records);
  }, [currentTab]);

  // Client-side filtering over already loaded rows
  const filteredRows = useMemo(() => {
    let rows = sortedRows;
    const q = foldText(search);
    if (q) {
      rows = rows.filter((r) => foldText(r.label).includes(q));
    }
    if (statusFilter === "has_expired") {
      rows = rows.filter((r) => r.expired > 0);
    } else if (statusFilter === "has_in_progress") {
      rows = rows.filter((r) => r.inProgress > 0);
    } else if (statusFilter === "no_completed") {
      rows = rows.filter((r) => r.done === 0);
    }
    const minRec = Number(minRecordsFilter);
    if (minRec > 0) {
      rows = rows.filter((r) => r.records >= minRec);
    }
    return rows;
  }, [sortedRows, search, statusFilter, minRecordsFilter]);

  // Fallback to first row if selected row is absent or filtered out
  const activeKey =
    selectedKey && filteredRows.some((r) => r.key === selectedKey)
      ? selectedKey
      : (filteredRows[0]?.key ?? null);

  const selectedRow = filteredRows.find((r) => r.key === activeKey) ?? null;

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
    <TooltipProvider>
      <div className="flex flex-col gap-3.5">
        {/* Filter Row directly above Explorer panel */}
        <div
          id="dashboard-filters"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-xs"
        >
          {/* Left: Active filters count chip & Clear filters */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-caption font-medium text-foreground">Active filters</span>
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {activeFilterCount}
            </span>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Right: Dropdowns and Search Input */}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5 sm:flex-nowrap">
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "all")}>
              <SelectTrigger
                aria-label="Filter by certificate status"
                className="h-8 w-[160px] text-xs"
              >
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                <SelectItem value="has_expired">Has expired certificates</SelectItem>
                <SelectItem value="has_in_progress">Has in-progress</SelectItem>
                <SelectItem value="no_completed">No completed yet</SelectItem>
              </SelectContent>
            </Select>

            {/* Min Records Filter */}
            <Select value={minRecordsFilter} onValueChange={(val) => setMinRecordsFilter(val ?? "0")}>
              <SelectTrigger
                aria-label="Filter by minimum records"
                className="h-8 w-[130px] text-xs"
              >
                <SelectValue placeholder="Min records: Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Min records: Any</SelectItem>
                <SelectItem value="1">1+ records</SelectItem>
                <SelectItem value="5">5+ records</SelectItem>
                <SelectItem value="10">10+ records</SelectItem>
              </SelectContent>
            </Select>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="explorer-search-input"
                placeholder={`Filter ${currentTab?.groupLabel.toLowerCase() ?? "items"}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
                aria-label={`Filter ${currentTab?.groupLabel.toLowerCase() ?? "items"}`}
              />
            </div>
          </div>
        </div>

        {/* Master-Detail Board with Tabs matching the template */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              if (val) setActiveTab(val);
            }}
            className="flex flex-col"
          >
            {/* Top Tab Strip with Count Badges */}
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

            {/* Tab Contents */}
            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="m-0 focus-visible:outline-none">
                <section aria-label={tab.label} className="grid grid-cols-1 lg:grid-cols-12 min-w-0">
                  {tab.rows.length === 0 ? (
                    <div className="p-8 lg:col-span-12">
                      <EmptyState
                        title="No data yet"
                        description={tab.emptyHint ?? "There are no records to count yet."}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Left pane: Master Item List */}
                      <div className="flex flex-col gap-2.5 border-b border-border p-4 lg:col-span-5 lg:border-b-0 lg:border-r">
                        {/* Header row for list */}
                        <div className="flex items-center justify-between px-1 text-label font-medium uppercase text-muted-foreground">
                          <span>{tab.groupLabel}</span>
                          <span>Records</span>
                        </div>

                        {/* Master Item List */}
                        <div
                          role="table"
                          aria-label={tab.label}
                          className="flex flex-col gap-2 overflow-y-auto max-h-[520px] pr-0.5"
                        >
                          {filteredRows.length === 0 ? (
                            <div
                              role="row"
                              className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center"
                            >
                              <p className="text-caption text-muted-foreground">No matching items found.</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={clearFilters}
                                className="h-7 text-xs"
                              >
                                Clear filters
                              </Button>
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
                                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground shadow-xs ring-2 ring-primary ring-offset-2 ring-offset-background"
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
                                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                                        )}
                                      >
                                        {row.headcount !== null ? `${formatNumber(row.headcount)} headcount · ` : ""}
                                        {formatNumber(row.people)} {tab.peopleLabel.toLowerCase()}
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
                                          isSelected ? "text-primary-foreground/80" : "text-caption text-muted-foreground",
                                        )}
                                      >
                                        records
                                      </span>
                                    </span>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1.5 text-caption",
                                        isSelected ? "text-primary-foreground/90" : "text-muted-foreground",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "inline-block size-1.5 rounded-full",
                                          isSelected
                                            ? "bg-primary-foreground"
                                            : rate === 100
                                              ? "bg-[var(--status-active-fg)]"
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

                      {/* Right pane: Detail dossier for selected row */}
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
                                className="text-page-title font-bold tracking-tight text-foreground truncate"
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

                            {/* Middle: 4 Sub-Metric Cards Grid */}
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
                    </>
                  )}
                </section>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
