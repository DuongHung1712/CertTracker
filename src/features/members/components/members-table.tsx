"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { MemberCode } from "@/components/status/member-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatYoe } from "@/features/career/format";
import { removeManagerScopes } from "@/features/organizations/actions";
import { deleteMember } from "@/features/members/actions";
import { ROLE_LABEL, type Role } from "@/components/status/labels";
import { MemberDialog } from "@/features/members/components/member-dialog";

type Member = {
  id: string;
  code: string;
  fullName: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  isActive: boolean;
  userId: string | null;
  accessRole: Role | null;
  careerRoleId: string | null;
  careerRoleName: string | null;
  careerStart: string | null;
  yoeYears: number | null;
};
type RoleOption = { id: string; name: string };
type Scope = { label: string; active: boolean };
type TeamOption = { id: string; name: string };

export function MembersTable({
  members,
  teams,
  roles,
  scopes,
  showScopes,
  canCreate,
  canDelete,
  canEditCareer,
}: {
  members: Member[];
  teams: TeamOption[];
  roles: RoleOption[];
  /** Manager scopes keyed by user id (Admin only; empty otherwise). */
  scopes: Record<string, Scope[]>;
  showScopes: boolean;
  canCreate: boolean;
  canDelete: boolean;
  /** Admin only: sets the career role and start in the member form. */
  canEditCareer: boolean;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState<Member | null>(null);
  const [pending, setPending] = useState(false);
  const [clearingScopes, setClearingScopes] = useState<Member | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.code} ${m.fullName} ${m.email}`.toLowerCase().includes(q));
  }, [members, search]);

  const columns: ColumnDef<Member, unknown>[] = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <MemberCode code={row.original.code} /> },
    { accessorKey: "fullName", header: "Full name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "teamName", header: "Team", cell: ({ row }) => row.original.teamName ?? "—" },
    { accessorKey: "careerRoleName", header: "Role", cell: ({ row }) => row.original.careerRoleName ?? "Not set" },
    {
      accessorKey: "yoeYears",
      header: "Experience",
      cell: ({ row }) => formatYoe(row.original.yoeYears),
      // Not set (null) sorts below every number.
      sortingFn: (a, b) => (a.original.yoeYears ?? -1) - (b.original.yoeYears ?? -1),
      meta: { align: "right" },
    },
    ...(showScopes
      ? ([
          {
            accessorKey: "accessRole",
            header: "Access",
            cell: ({ row }) => (row.original.accessRole ? ROLE_LABEL[row.original.accessRole] : "No account"),
          },
          {
            id: "scopes",
            header: "Manages",
            enableSorting: false,
            cell: ({ row }) => (
              <ScopesCell
                scopes={row.original.userId ? scopes[row.original.userId] : undefined}
                onRemove={() => setClearingScopes(row.original)}
              />
            ),
          },
        ] satisfies ColumnDef<Member, unknown>[])
      : []),
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="secondary" className="rounded-sm">
            Active
          </Badge>
        ) : (
          <span className="text-caption text-muted-foreground">Inactive</span>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Actions for ${row.original.fullName}`} />}>
            <MoreHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original);
                setDialogOpen(true);
              }}
            >
              Edit
            </DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirming(row.original)}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteMember({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Deleted member ${confirming.fullName}`);
    setConfirming(null);
  }

  async function handleRemoveScopes() {
    if (!clearingScopes?.userId) return;
    setPending(true);
    const result = await removeManagerScopes({ userId: clearingScopes.userId });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setClearingScopes(null);
      return;
    }
    toast.success(`Removed manager access for ${clearingScopes.fullName}`);
    setClearingScopes(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, code or email…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      >
        {canCreate && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={teams.length === 0}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Add member
          </Button>
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={
          members.length === 0 ? (
            <EmptyState title="No members yet" description="Add the first member to start tracking your team." />
          ) : (
            <EmptyState title="No members found" description="Try a different search or clear the filters." />
          )
        }
      />
      <MemberDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} teams={teams} roles={roles} canEditCareer={canEditCareer} />
      {showScopes && (
        <ConfirmDialog
          open={!!clearingScopes}
          onOpenChange={(open) => !open && setClearingScopes(null)}
          title={`Remove manager access to teams for ${clearingScopes?.fullName}?`}
          description={`${clearingScopes?.fullName ?? "This member"} is no longer a Manager, so this team access is not used. You cannot undo this.`}
          confirmLabel="Remove access"
          pendingLabel="Removing…"
          pending={pending}
          onConfirm={handleRemoveScopes}
        />
      )}
      {canDelete && (
        <ConfirmDialog
          open={!!confirming}
          onOpenChange={(open) => !open && setConfirming(null)}
          title={`Delete member ${confirming?.code} · ${confirming?.fullName}?`}
          description="A member can only be deleted when they have no certificates. This cannot be undone."
          confirmLabel="Delete member"
          pendingLabel="Deleting…"
          pending={pending}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function ScopesCell({ scopes, onRemove }: { scopes: Scope[] | undefined; onRemove: () => void }) {
  if (!scopes || scopes.length === 0) return <span className="text-muted-foreground">—</span>;
  const inactive = scopes.every((scope) => !scope.active);
  return (
    <div className="flex flex-col gap-0.5">
      <span className={inactive ? "text-muted-foreground" : undefined}>
        Manages: {scopes.map((scope) => scope.label).join(", ")}
      </span>
      {inactive && (
        <span className="flex items-center gap-2">
          <span className="text-caption text-destructive">Not a manager: team access not used</span>
          <Button variant="ghost" size="xs" onClick={onRemove}>
            Remove access
          </Button>
        </span>
      )}
    </div>
  );
}
