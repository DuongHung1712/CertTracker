"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ProgressInline } from "@/components/status/progress-inline";
import { rateOf } from "@/features/dashboard/components/explorer/types";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Rows with nothing to divide (`records === 0`) have no rate; sort them below every real rate. */
const NO_RATE = -1;

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
        meta: { align: "right" },
      },
      {
        accessorKey: "records",
        header: "Certificates",
        cell: ({ row }) => formatNumber(row.original.records),
        meta: { align: "right" },
      },
      {
        id: "rate",
        header: "Completed",
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
      {
        accessorKey: "inProgress",
        header: "In progress",
        cell: ({ row }) => formatNumber(row.original.inProgress),
        meta: { align: "right" },
      },
      {
        accessorKey: "valid",
        header: "Valid",
        cell: ({ row }) => formatNumber(row.original.valid),
        meta: { align: "right" },
      },
      {
        accessorKey: "expired",
        header: "Expired",
        // The number stays visible: colour alone must not carry the warning.
        cell: ({ row }) => (
          <span className={cn(row.original.expired > 0 && "font-medium text-destructive")}>
            {formatNumber(row.original.expired)}
          </span>
        ),
        meta: { align: "right" },
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
      empty={<EmptyState title="No data yet" description={emptyHint ?? "Add certificates to see this breakdown."} />}
    />
  );
}
