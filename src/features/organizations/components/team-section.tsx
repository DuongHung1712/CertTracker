"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteTeam } from "@/features/organizations/actions";
import { ManagersCell } from "@/features/organizations/components/managers-cell";
import { ScopeManagersDialog } from "@/features/organizations/components/scope-managers-dialog";
import { TeamDialog } from "@/features/organizations/components/team-dialog";

type Team = { id: string; name: string; programId: string; programName: string; managerIds: string[] };
type ProgramOption = { id: string; name: string; managerIds?: string[] };
type Candidate = { userId: string; fullName: string; email: string };

export function TeamSection({
  teams,
  programs,
  candidates,
  canManage,
}: {
  teams: Team[];
  programs: ProgramOption[];
  candidates: Candidate[];
  canManage: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [confirming, setConfirming] = useState<Team | null>(null);
  const [settingManagers, setSettingManagers] = useState<Team | null>(null);
  const [pending, setPending] = useState(false);

  const programManagersById = useMemo(
    () => new Map(programs.map((program) => [program.id, program.managerIds ?? []])),
    [programs],
  );

  const columns: ColumnDef<Team, unknown>[] = [
    { accessorKey: "name", header: "Team name" },
    { accessorKey: "programName", header: "Program" },
    {
      id: "managers",
      header: "Managers",
      enableSorting: false,
      cell: ({ row }) => (
        <ManagersCell
          managerIds={row.original.managerIds}
          inheritedManagerIds={programManagersById.get(row.original.programId) ?? []}
          candidates={candidates}
        />
      ),
    },
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
        ] satisfies ColumnDef<Team, unknown>[])
      : []),
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteTeam({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Deleted team ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Teams</h2>
        {canManage && (
          <Button
            size="sm"
            disabled={programs.length === 0}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Add team
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={teams}
        getRowId={(row) => row.id}
        empty={
          <EmptyState
            title="No teams yet"
            description={programs.length === 0 ? "Add a program first." : "Add the first team."}
          />
        }
      />
      {canManage && (
        <>
          <TeamDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            editing={editing}
            programs={programs}
          />
          <ScopeManagersDialog
            scope={
              settingManagers
                ? {
                    kind: "team",
                    id: settingManagers.id,
                    name: settingManagers.name,
                    managerIds: settingManagers.managerIds,
                    programName: settingManagers.programName,
                    inheritedManagerIds: programManagersById.get(settingManagers.programId) ?? [],
                  }
                : null
            }
            candidates={candidates}
            onClose={() => setSettingManagers(null)}
          />
          <ConfirmDialog
            open={!!confirming}
            onOpenChange={(open) => !open && setConfirming(null)}
            title={`Delete team ${confirming?.name ?? ""}?`}
            description="Members of this team are kept but will have no team; managers of this team will no longer manage it. This cannot be undone."
            confirmLabel="Delete team"
            pendingLabel="Deleting…"
            pending={pending}
            onConfirm={handleDelete}
          />
        </>
      )}
    </section>
  );
}
