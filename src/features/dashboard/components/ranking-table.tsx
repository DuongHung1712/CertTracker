"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { MemberCode } from "@/components/status/member-code";
import { rankingForDisplay } from "@/features/dashboard/metrics";
import type { RankingRow } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";

// Module-level: the columns depend on nothing, and a fresh array per render would remount every cell.
const COLUMNS: ColumnDef<RankingRow, unknown>[] = [
  {
    accessorKey: "rank",
    header: "Rank",
    cell: ({ row }) => <span className="tabular-nums font-medium">{row.original.rank}</span>,
    meta: { align: "right" },
  },
  { accessorKey: "memberCode", header: "Code", cell: ({ row }) => <MemberCode code={row.original.memberCode} /> },
  { accessorKey: "fullName", header: "Full name" },
  { accessorKey: "teamName", header: "Team", cell: ({ row }) => row.original.teamName ?? "—" },
  {
    accessorKey: "validCerts",
    header: "Valid",
    cell: ({ row }) => formatNumber(row.original.validCerts),
    meta: { align: "right" },
  },
  {
    accessorKey: "doneCerts",
    header: "Completed",
    cell: ({ row }) => formatNumber(row.original.doneCerts),
    meta: { align: "right" },
  },
  {
    accessorKey: "inProgress",
    header: "In progress",
    cell: ({ row }) => formatNumber(row.original.inProgress),
    meta: { align: "right" },
  },
];

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  const data = useMemo(() => rankingForDisplay(rows), [rows]);
  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      pageSize={10}
      getRowId={(row) => row.memberId}
      empty={
        <EmptyState
          title="No members to rank"
          description="Members appear here after their first completed certificate."
        />
      }
    />
  );
}
