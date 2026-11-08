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
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(val) => onStatusFilterChange(val ?? "all")}>
          <SelectTrigger
            aria-label="Filter by certificate status"
            className="h-8 min-w-28 flex-1 text-xs"
          >
            <SelectValue placeholder={STATUS_FILTER_LABELS.all}>
              {(val: string) => STATUS_FILTER_LABELS[val] ?? STATUS_FILTER_LABELS.all}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Minimum certificates filter */}
        <Select value={minRecordsFilter} onValueChange={(val) => onMinRecordsFilterChange(val ?? "0")}>
          <SelectTrigger
            aria-label="Filter by number of certificates"
            className="h-8 min-w-28 flex-1 text-xs"
          >
            <SelectValue placeholder={MIN_RECORDS_FILTER_LABELS["0"]}>
              {(val: string) => MIN_RECORDS_FILTER_LABELS[val] ?? MIN_RECORDS_FILTER_LABELS["0"]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MIN_RECORDS_FILTER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search Input */}
        <div className="relative min-w-28 flex-1">
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
