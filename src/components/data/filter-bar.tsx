"use client";

import { Search } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm…",
  hasActiveFilters,
  onClear,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  hasActiveFilters: boolean;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search aria-hidden className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-8 pl-8"
        />
      </div>
      {children}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onClear();
            // "Xóa lọc" removes itself from the DOM; without this, focus
            // would drop to <body>.
            searchInputRef.current?.focus();
          }}
        >
          Xóa lọc
        </Button>
      )}
    </div>
  );
}
