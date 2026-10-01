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
  parsed: "Chờ nhập",
  committed: "Đã nhập",
  discarded: "Đã hủy",
};

export function BatchHistory({ batches }: { batches: ImportBatch[] }) {
  // Memoised: a fresh `columns` array per render would remount every cell.
  const columns = useMemo<ColumnDef<ImportBatch, unknown>[]>(
    () => [
      { accessorKey: "fileName", header: "Tên file", cell: ({ row }) => <span className="break-all">{row.original.fileName}</span> },
      {
        accessorKey: "createdAt",
        header: "Thời gian",
        // ISO timestamps sort correctly as text.
        cell: ({ row }) => formatDateTimeVn(row.original.createdAt),
      },
      {
        accessorKey: "status",
        header: "Trạng thái",
        cell: ({ row }) => BATCH_STATUS_LABEL[row.original.status],
      },
      {
        id: "result",
        header: "Kết quả",
        enableSorting: false,
        cell: ({ row }) => {
          const { status, summary } = row.original;
          return status === "committed" && summary ? `Tạo mới ${summary.created} · Cập nhật ${summary.updated}` : "—";
        },
      },
      {
        id: "view",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/import/${row.original.id}`}
            aria-label={`Xem lô ${row.original.fileName}`}
            className={buttonVariants({ variant: "ghost", size: "xs" })}
          >
            Xem
          </Link>
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
      empty={<EmptyState title="Chưa có lần nhập nào" />}
    />
  );
}
