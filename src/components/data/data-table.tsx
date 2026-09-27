"use client";

import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/data/empty-state";
import { pageRangeLabel } from "@/components/data/pagination";

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  empty?: React.ReactNode;
  pageSize?: number;
  getRowId?: (row: TData, index: number) => string;
};

// Sorts Vietnamese text correctly by default (Đ between D and E, diacritics
// ignored) and compares numbers numerically. A column with its own meaning
// of "order" — e.g. an expiry column that should sort by days left, not by
// the English `expiry_status` string — passes its own `sortingFn` to
// override this.
const viCollator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

function defaultSortingFn(rowA: { getValue: (id: string) => unknown }, rowB: { getValue: (id: string) => unknown }, columnId: string) {
  const a = rowA.getValue(columnId);
  const b = rowB.getValue(columnId);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return viCollator.compare(String(a ?? ""), String(b ?? ""));
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  error = null,
  empty,
  pageSize = 25,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize } },
    defaultColumn: { sortingFn: defaultSortingFn },
  });

  const columnCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const showFooter = !isLoading && !error;

  return (
    <div className="flex flex-col gap-2">
      {/*
       * A single scroll container (Table's own `overflow-x-auto`, from
       * ui/table.tsx) — the design was to also stick the header while
       * scrolling, but that needs a bounded-height frame (awkward on
       * mobile) and was dropped; `overflow-hidden` here only clips the
       * table's square corners to this box's rounded ones.
       */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table className="text-table tabular-nums">
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className="h-8 bg-muted px-2.5 text-label uppercase text-muted-foreground first:sticky first:left-0 first:z-[1]"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 uppercase"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon aria-hidden className="size-3.5" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  role="alert"
                  className="px-2.5 py-6 text-center whitespace-normal text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <>
                <TableRow className="sr-only">
                  <TableCell colSpan={columnCount}>Đang tải…</TableCell>
                </TableRow>
                {Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={`skeleton-${i}`} aria-hidden className="hover:bg-transparent">
                    <TableCell colSpan={columnCount} className="h-8 px-2.5 py-1">
                      <Skeleton className="h-4 w-full motion-reduce:animate-none" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="whitespace-normal">
                  {empty ?? <EmptyState title="Không có dữ liệu" />}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="group h-8 hover:bg-accent">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-2.5 py-1 first:sticky first:left-0 first:z-[1] first:bg-card group-hover:first:bg-accent"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {showFooter && (
        <div className="flex items-center justify-end gap-2 text-caption text-muted-foreground">
          <span className="tabular-nums">{pageRangeLabel(pageIndex, currentPageSize, totalRows)}</span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang trước"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang sau"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
