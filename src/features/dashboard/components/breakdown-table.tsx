"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ProgressInline } from "@/components/status/progress-inline";
import { ratePercent } from "@/features/dashboard/metrics";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Rows with nothing to divide (`records === 0`) have no rate; sort them below every real rate. */
const NO_RATE = -1;

const rateOf = (row: BreakdownRow): number | null => ratePercent(row.done, row.records);

export function BreakdownTable({
  rows,
  groupLabel,
  peopleLabel,
  emptyHint,
}: {
  rows: BreakdownRow[];
  groupLabel: string;
  peopleLabel: string;
  emptyHint?: string;
}) {
  // Memoised: react-table renders each `cell` as a component, so a fresh `columns` array per render remounts cells.
  const columns = useMemo<ColumnDef<BreakdownRow, unknown>[]>(
    () => [
      {
        id: "label",
        header: groupLabel,
        accessorFn: (row) => row.label,
        cell: ({ row }) => (
          <span className="block max-w-64 truncate" title={row.original.label}>
            {row.original.label}
          </span>
        ),
      },
      {
        id: "people",
        header: peopleLabel,
        accessorFn: (row) => row.headcount ?? row.people,
        cell: ({ getValue }) => formatNumber(getValue<number>()),
      },
      { accessorKey: "records", header: "Bản ghi", cell: ({ row }) => formatNumber(row.original.records) },
      {
        id: "rate",
        header: "Hoàn thành",
        accessorFn: (row) => rateOf(row) ?? NO_RATE,
        cell: ({ row }) => {
          const rate = rateOf(row.original);
          if (rate === null) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-2">
              <ProgressInline value={rate} />
              <span className="text-caption tabular-nums text-muted-foreground">
                {`${formatNumber(row.original.done)}/${formatNumber(row.original.records)}`}
              </span>
            </div>
          );
        },
      },
      { accessorKey: "inProgress", header: "Đang học", cell: ({ row }) => formatNumber(row.original.inProgress) },
      { accessorKey: "valid", header: "Còn hiệu lực", cell: ({ row }) => formatNumber(row.original.valid) },
      {
        accessorKey: "expired",
        header: "Đã hết hạn",
        // The number stays visible: colour alone must not carry the warning.
        cell: ({ row }) => (
          <span className={cn(row.original.expired > 0 && "font-medium text-destructive")}>
            {formatNumber(row.original.expired)}
          </span>
        ),
      },
    ],
    [groupLabel, peopleLabel],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      pageSize={10}
      getRowId={(row) => row.key}
      empty={<EmptyState title="Chưa có dữ liệu" description={emptyHint ?? "Chưa có bản ghi nào để thống kê."} />}
    />
  );
}
