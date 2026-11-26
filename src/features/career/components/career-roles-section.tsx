"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteCareerRole, moveCareerRole } from "@/features/career/actions";
import { CareerRoleDialog } from "@/features/career/components/career-role-dialog";
import type { CareerRole } from "@/features/career/queries";

/** Admin: the career path members are placed on (M5 attaches criteria to these roles). */
export function CareerRolesSection({ roles }: { roles: CareerRole[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CareerRole | null>(null);
  const [confirming, setConfirming] = useState<CareerRole | null>(null);
  const [pending, setPending] = useState(false);

  async function move(role: CareerRole, direction: "up" | "down") {
    setPending(true);
    const result = await moveCareerRole({ id: role.id, direction });
    setPending(false);
    if (!result.ok) toast.error(result.error, { duration: Infinity });
  }

  const columns: ColumnDef<CareerRole, unknown>[] = [
    {
      id: "position",
      header: "#",
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => row.index + 1,
    },
    { accessorKey: "name", header: "Career role", enableSorting: false },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="-my-1"
                  aria-label={`Move ${row.original.name} up`}
                  disabled={pending || row.index === 0}
                  onClick={() => move(row.original, "up")}
                >
                  <ArrowUp aria-hidden />
                </Button>
              }
            />
            <TooltipContent>Move up</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="-my-1"
                  aria-label={`Move ${row.original.name} down`}
                  disabled={pending || row.index === roles.length - 1}
                  onClick={() => move(row.original, "down")}
                >
                  <ArrowDown aria-hidden />
                </Button>
              }
            />
            <TooltipContent>Move down</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDialogOpen(true);
            }}
          >
            Rename
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirming(row.original)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteCareerRole({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error, { duration: Infinity });
      setConfirming(null);
      return;
    }
    toast.success(`Deleted role ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="career-roles-heading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="career-roles-heading" className="text-section-title">
            Career roles
          </h2>
          <p className="text-caption text-muted-foreground">
            Ordered from entry-level to senior; use the arrows to adjust the progression.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Add career role
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={roles}
        getRowId={(row) => row.id}
        empty={<EmptyState title="No career roles yet" description="Add the first role of the career path." />}
      />
      <CareerRoleDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Delete the role ${confirming?.name ?? ""}?`}
        description="A role that members still hold cannot be deleted. This cannot be undone."
        confirmLabel="Delete role"
        pendingLabel="Deleting…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
