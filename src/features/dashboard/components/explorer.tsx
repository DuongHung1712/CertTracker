"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/data/empty-state";
import { ProgressInline } from "@/components/status/progress-inline";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type TabConfig = {
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
      <EmptyState
        title="No data yet"
        description={tab.emptyHint ?? "There are no records to count yet."}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left pane: search and compact list */}
      <div className="flex flex-col gap-3 lg:col-span-7">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={`Filter ${tab.groupLabel.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
            aria-label={`Filter ${tab.groupLabel.toLowerCase()}`}
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table aria-label={tab.label} className="text-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 bg-muted px-3 text-label font-medium uppercase text-muted-foreground">
                  {tab.groupLabel}
                </TableHead>
                <TableHead className="h-8 bg-muted px-3 text-right text-label font-medium uppercase text-muted-foreground">
                  Records
                </TableHead>
                <TableHead className="h-8 bg-muted px-3 text-right text-label font-medium uppercase text-muted-foreground">
                  Completed
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                    No matching items found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => {
                  const isSelected = row.key === activeKey;
                  const rate = rateOf(row);
                  return (
                    <TableRow
                      key={row.key}
                      aria-selected={isSelected}
                      onClick={() => setSelectedKey(row.key)}
                      className={cn(
                        "h-8 cursor-pointer transition-colors hover:bg-accent/50",
                        isSelected && "bg-accent text-accent-foreground font-medium"
                      )}
                    >
                      <TableCell className="px-3 py-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedKey(row.key);
                          }}
                          aria-current={isSelected ? "true" : undefined}
                          className="block max-w-56 truncate text-left font-inherit outline-none focus-visible:underline"
                          title={row.label}
                        >
                          {row.label}
                        </button>
                      </TableCell>
                      <TableCell className="px-3 py-1 text-right tabular-nums">
                        {formatNumber(row.records)}
                      </TableCell>
                      <TableCell className="px-3 py-1 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ProgressInline value={rate ?? 0} />
                          <span className="text-caption tabular-nums text-muted-foreground">
                            {formatRate(rate)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Right pane: detail panel for selected row */}
      <div className="lg:col-span-5">
        {selectedRow ? (
          <div
            data-testid="explorer-detail-panel"
            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-colors"
          >
            <div className="flex flex-col gap-0.5 border-b border-border pb-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Detail View
              </span>
              <h3
                className="text-section-title font-semibold text-foreground truncate"
                title={selectedRow.label}
              >
                {selectedRow.label}
              </h3>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-2.5">
                <dt className="text-caption text-muted-foreground">
                  {selectedRow.headcount !== null ? "Headcount" : tab.peopleLabel}
                </dt>
                <dd className="text-section-title font-semibold tabular-nums text-foreground">
                  {formatNumber(selectedRow.headcount ?? selectedRow.people)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-2.5">
                <dt className="text-caption text-muted-foreground">Total records</dt>
                <dd className="text-section-title font-semibold tabular-nums text-foreground">
                  {formatNumber(selectedRow.records)}
                </dd>
              </div>
            </dl>

            {/* Completion rate bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-caption">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatRate(rateOf(selectedRow))}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({formatNumber(selectedRow.done)}/{formatNumber(selectedRow.records)})
                  </span>
                </span>
              </div>
              <ProgressInline value={rateOf(selectedRow) ?? 0} />
            </div>

            {/* Stacked bar of Completed / In progress / Not started */}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="text-caption font-medium text-foreground">Study status</span>
              <StatusBar
                segments={studyStatusSplit({
                  done: selectedRow.done,
                  inProgress: selectedRow.inProgress,
                  notStarted: selectedRow.notStarted,
                })}
                showLabels
              />
            </div>

            {/* Valid vs Expired split */}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="text-caption font-medium text-foreground">Validity</span>
              <StatusBar
                segments={validVsExpiredSplit({
                  valid: selectedRow.valid,
                  expired: selectedRow.expired,
                })}
                showLabels
              />
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-caption text-muted-foreground">
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
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
      <div className="border-b border-border pb-1">
        <TabsList className="h-9">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          {/* aria-label ensures this region has the exact name needed by e2e tests */}
          <section aria-label={tab.label} className="flex min-w-0 flex-col gap-4">
            <ExplorerPane tab={tab} />
          </section>
        </TabsContent>
      ))}
    </Tabs>
  );
}
