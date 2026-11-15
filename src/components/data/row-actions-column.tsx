"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Trailing column with an Edit / Delete menu per row; add it only for users who can manage the table. */
export function rowActionsColumn<T>({
  rowLabel,
  onEdit,
  onDelete,
}: {
  rowLabel: (row: T) => string;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
}): ColumnDef<T, unknown> {
  return {
    id: "actions",
    header: "",
    enableSorting: false,
    meta: { className: "sticky right-0 z-[1] w-10", cellClassName: "bg-card group-hover:bg-accent" },
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="-my-1" aria-label={`Actions for ${rowLabel(row.original)}`} />}>
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(row.original)}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };
}
