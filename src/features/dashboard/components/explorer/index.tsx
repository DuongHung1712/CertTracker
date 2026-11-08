"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/data/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DetailPanel } from "@/features/dashboard/components/explorer/detail-panel";
import { FilterRow } from "@/features/dashboard/components/explorer/filter-row";
import { MasterList } from "@/features/dashboard/components/explorer/master-list";
import type { TabConfig } from "@/features/dashboard/components/explorer/types";
import { SectionError } from "@/features/dashboard/components/section";
import { foldText } from "@/lib/text";

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
    if (!currentTab || !currentTab.result.ok) return [];
    return [...currentTab.result.data].sort((a, b) => b.records - a.records);
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

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3.5">
        {/* Filter Row directly above Explorer panel */}
        <FilterRow
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          minRecordsFilter={minRecordsFilter}
          onMinRecordsFilterChange={setMinRecordsFilter}
          activeFilterCount={activeFilterCount}
          onClearFilters={clearFilters}
          currentGroupLabel={currentTab?.groupLabel ?? "Items"}
        />

        {/* Master-Detail Board with Tabs matching the template */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
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
                    className="h-7 rounded-md px-3 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground"
                  >
                    <span>{tab.label}</span>
                    {tab.result.ok && (
                      <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-caption font-semibold tabular-nums text-muted-foreground">
                        {tab.result.data.length}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab Contents */}
            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="m-0 focus-visible:outline-none">
                <section aria-label={tab.label} className="grid grid-cols-1 lg:grid-cols-12 min-w-0">
                  {!tab.result.ok ? (
                    <div className="p-8 lg:col-span-12">
                      <SectionError title={tab.label} />
                    </div>
                  ) : tab.result.data.length === 0 ? (
                    <div className="p-8 lg:col-span-12">
                      <EmptyState
                        title="No data yet"
                        description="There are no records to count yet."
                      />
                    </div>
                  ) : (
                    <>
                      {/* Left pane: Master Item List */}
                      <MasterList
                        rows={filteredRows}
                        activeKey={activeKey}
                        onSelectKey={setSelectedKey}
                        groupLabel={tab.groupLabel}
                        peopleLabel={tab.peopleLabel}
                        tabLabel={tab.label}
                        onClearFilters={clearFilters}
                      />

                      {/* Right pane: Detail dossier for selected row */}
                      <DetailPanel
                        selectedRow={selectedRow}
                        groupLabel={tab.groupLabel}
                        peopleLabel={tab.peopleLabel}
                      />
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
