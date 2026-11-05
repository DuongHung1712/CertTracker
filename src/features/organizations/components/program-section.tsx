"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteProgram } from "@/features/organizations/actions";
import { ProgramDialog } from "@/features/organizations/components/program-dialog";
import { ProgramManagersDialog } from "@/features/organizations/components/program-managers-dialog";

type Program = { id: string; name: string; dcId: string; dcName: string; managerIds: string[] };
type DcOption = { id: string; name: string };
type Candidate = { userId: string; fullName: string; email: string };

export function ProgramSection({
  programs,
  dcs,
  candidates,
  canManage,
}: {
  programs: Program[];
  dcs: DcOption[];
  candidates: Candidate[];
  canManage: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [confirming, setConfirming] = useState<Program | null>(null);
  const [settingManagers, setSettingManagers] = useState<Program | null>(null);
  const [pending, setPending] = useState(false);

  const columns: ColumnDef<Program, unknown>[] = [
    { accessorKey: "name", header: "Program name" },
    { accessorKey: "dcName", header: "Centre" },
    ...(canManage
      ? ([
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSettingManagers(row.original)}>
                  Set managers
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(row.original);
                    setDialogOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(row.original)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ] satisfies ColumnDef<Program, unknown>[])
      : []),
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteProgram({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Deleted program ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Programs</h2>
        {canManage && (
          <Button
            size="sm"
            disabled={dcs.length === 0}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Add program
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={programs}
        getRowId={(row) => row.id}
        empty={
          <EmptyState
            title="No programs yet"
            description={dcs.length === 0 ? "Add a centre first." : "Add the first program."}
          />
        }
      />
      {canManage && (
        <>
          <ProgramDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} dcs={dcs} />
          <ProgramManagersDialog
            program={settingManagers}
            candidates={candidates}
            onClose={() => setSettingManagers(null)}
          />
          <ConfirmDialog
            open={!!confirming}
            onOpenChange={(open) => !open && setConfirming(null)}
            title={`Delete program ${confirming?.name}?`}
            description="A program can only be deleted when it has no teams."
            confirmLabel="Delete program"
            pendingLabel="Deleting…"
            pending={pending}
            onConfirm={handleDelete}
          />
        </>
      )}
    </section>
  );
}
