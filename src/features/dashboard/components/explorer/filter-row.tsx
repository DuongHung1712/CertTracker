"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MIN_RECORDS_FILTER_LABELS,
  STATUS_FILTER_LABELS,
} from "@/features/dashboard/components/explorer/types";

export function FilterRow({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  minRecordsFilter,
  onMinRecordsFilterChange,
  activeFilterCount,
  onClearFilters,
  currentGroupLabel,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  minRecordsFilter: string;
  onMinRecordsFilterChange: (value: string) => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  currentGroupLabel: string;
}) {
  return (
    <div
      id="dashboard-filters"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
    >
      {/* Left: Active filters count chip & Clear filters */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-caption font-medium text-foreground">Active filters</span>
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-caption font-semibold text-primary">
          {activeFilterCount}
        </span>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Right: Dropdowns and Search Input */}
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5 sm:flex-nowrap">
        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(val) => onStatusFilterChange(val ?? "all")}>
          <SelectTrigger
            aria-label="Filter by certificate status"
            className="h-8 w-[160px] text-xs"
          >
            <SelectValue placeholder="All groups">
              {(val: string) => STATUS_FILTER_LABELS[val] ?? "All groups"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            <SelectItem value="has_expired">Has expired certificates</SelectItem>
            <SelectItem value="has_in_progress">Has in-progress</SelectItem>
            <SelectItem value="no_completed">No completed yet</SelectItem>
          </SelectContent>
        </Select>

        {/* Min Records Filter */}
        <Select value={minRecordsFilter} onValueChange={(val) => onMinRecordsFilterChange(val ?? "0")}>
          <SelectTrigger
            aria-label="Filter by minimum records"
            className="h-8 w-[130px] text-xs"
          >
            <SelectValue placeholder="Min records: Any">
              {(val: string) => MIN_RECORDS_FILTER_LABELS[val] ?? "Min records: Any"}
            </SelectValue>
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
            placeholder={`Filter ${currentGroupLabel.toLowerCase()}…`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-xs"
            aria-label={`Filter ${currentGroupLabel.toLowerCase()}`}
          />
        </div>
      </div>
    </div>
  );
}
