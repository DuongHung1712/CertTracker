"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import type { ImportBatch } from "@/features/import/queries";
import { formatDateTimeVn } from "@/lib/format";

export const BATCH_STATUS_LABEL: Record<ImportBatch["status"], string> = {
  parsed: "Ready to import",
  committed: "Imported",
  discarded: "Discarded",
};

export function BatchHistory({ batches }: { batches: ImportBatch[] }) {
  // Memoised: a fresh `columns` array per render would remount every cell.
  const columns = useMemo<ColumnDef<ImportBatch, unknown>[]>(
    () => [
      { accessorKey: "fileName", header: "File name", cell: ({ row }) => <span className="break-all">{row.original.fileName}</span> },
      {
        accessorKey: "createdAt",
        header: "Uploaded",
        // ISO timestamps sort correctly as text.
        cell: ({ row }) => formatDateTimeVn(row.original.createdAt),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => BATCH_STATUS_LABEL[row.original.status],
      },
      {
        id: "result",
        header: "Result",
        enableSorting: false,
        cell: ({ row }) => {
          const { status, summary } = row.original;
          return status === "committed" && summary ? `Created ${summary.created} · Updated ${summary.updated}` : "—";
        },
      },
      {
        id: "view",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Link
              href={`/import/${row.original.id}`}
              aria-label={`View batch ${row.original.fileName}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              View
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={batches}
      getRowId={(row) => row.id}
      empty={
        <EmptyState
          title="No imports yet"
          description="Upload an Excel file above to preview and import records."
        />
      }
    />
  );
}
