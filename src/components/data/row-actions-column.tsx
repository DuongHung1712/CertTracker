"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Trailing column with an Edit / Delete menu per row; add it only for users who can manage the table. */
export function rowActionsColumn<T>({
  rowLabel,
  onEdit,
  onDelete,
  extraItems,
}: {
  rowLabel: (row: T) => string;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  extraItems?: (row: T) => React.ReactNode;
}): ColumnDef<T, unknown> {
  return {
    id: "actions",
    header: "",
    enableSorting: false,
    meta: { className: "sticky right-0 z-[1] w-10", cellClassName: "bg-card group-hover:bg-accent" },
    cell: ({ row }) => (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="-my-1"
                    aria-label={`Actions for ${rowLabel(row.original)}`}
                  />
                }
              />
            }
          >
            <MoreHorizontal aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="left">Actions</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          {extraItems?.(row.original)}
          <DropdownMenuItem onClick={() => onEdit(row.original)}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(row.original)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };
}
