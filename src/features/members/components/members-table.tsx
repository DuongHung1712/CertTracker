"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddButton } from "@/components/data/add-button";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { MemberCode } from "@/components/status/member-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatYoe } from "@/features/career/format";
import { removeManagerScopes } from "@/features/organizations/actions";
import { deleteMember } from "@/features/members/actions";
import { ROLE_LABEL, type Role } from "@/components/status/labels";
import { RoleBadge } from "@/components/status/role-badge";
import { MemberDialog } from "@/features/members/components/member-dialog";
import { foldText } from "@/lib/text";

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

const FILTER_ALL = "all";
const FILTER_NONE = "none";
type StatusFilter = typeof FILTER_ALL | "active" | "inactive";
type AccessFilter = typeof FILTER_ALL | Role | typeof FILTER_NONE;

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
};

const ACCESS_FILTER_LABEL: Record<AccessFilter, string> = {
  all: "All access",
  admin: ROLE_LABEL.admin,
  manager: ROLE_LABEL.manager,
  member: ROLE_LABEL.member,
  none: "No account",
};

export function MembersTable({
  members,
  teams,
  roles,
  scopes,
  showScopes,
  canCreate,
  canDelete,
  canEditCareer,
  initialSearch = "",
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
  /** Starting value of the search box (Data Quality links here with ?search=<name>). */
  initialSearch?: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [teamFilter, setTeamFilter] = useState<string>(FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(FILTER_ALL);
  const [accessFilter, setAccessFilter] = useState<AccessFilter>(FILTER_ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState<Member | null>(null);
  const [pending, setPending] = useState(false);
  const [clearingScopes, setClearingScopes] = useState<Member | null>(null);
  const hasNoTeam = useMemo(() => members.some((m) => m.teamId === null), [members]);

  const hasActiveFilters =
    search.length > 0 || teamFilter !== FILTER_ALL || statusFilter !== FILTER_ALL || accessFilter !== FILTER_ALL;

  const rows = useMemo(() => {
    const q = foldText(search);
    return members.filter((m) => {
      if (teamFilter === FILTER_NONE ? m.teamId !== null : teamFilter !== FILTER_ALL && m.teamId !== teamFilter) {
        return false;
      }
      if (statusFilter === "active" && !m.isActive) return false;
      if (statusFilter === "inactive" && m.isActive) return false;
      if (showScopes && accessFilter !== FILTER_ALL) {
        if (accessFilter === FILTER_NONE ? m.accessRole !== null : m.accessRole !== accessFilter) return false;
      }
      if (!q) return true;
      return foldText(`${m.code} ${m.fullName} ${m.email} ${m.teamName ?? ""} ${m.careerRoleName ?? ""}`).includes(q);
    });
  }, [members, search, teamFilter, statusFilter, accessFilter, showScopes]);

  const columns: ColumnDef<Member, unknown>[] = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <MemberCode code={row.original.code} /> },
    {
      accessorKey: "fullName",
      header: "Full name",
      cell: ({ row }) => (
        <span className="block max-w-[20rem] truncate" title={row.original.fullName}>
          {row.original.fullName}
        </span>
      ),
    },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "teamName", header: "Team", cell: ({ row }) => row.original.teamName ?? "—" },
    { accessorKey: "careerRoleName", header: "Career role", cell: ({ row }) => row.original.careerRoleName ?? "Not set" },
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
            cell: ({ row }) =>
              row.original.accessRole ? <RoleBadge role={row.original.accessRole} /> : <span className="text-muted-foreground">No account</span>,
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
      meta: { className: "sticky right-0 z-[1] w-10", cellClassName: "bg-card group-hover:bg-accent" },
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="-my-1" aria-label={`Actions for ${row.original.fullName}`} />}>
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
      toast.error(result.error, { duration: Infinity });
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
      toast.error(result.error, { duration: Infinity });
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
        searchPlaceholder="Search by name, code, email, team or career role…"
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setTeamFilter(FILTER_ALL);
          setStatusFilter(FILTER_ALL);
          setAccessFilter(FILTER_ALL);
        }}
      >
        <Select value={teamFilter} onValueChange={(value) => setTeamFilter(value ?? FILTER_ALL)}>
          <SelectTrigger aria-label="Filter by team" className="min-w-36">
            <SelectValue>
              {(value: string) =>
                value === FILTER_ALL
                  ? "All teams"
                  : value === FILTER_NONE
                    ? "No team"
                    : (teams.find((t) => t.id === value)?.name ?? "All teams")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>All teams</SelectItem>
            {(hasNoTeam || teamFilter === FILTER_NONE) && <SelectItem value={FILTER_NONE}>No team</SelectItem>}
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter((value as StatusFilter) ?? FILTER_ALL)}>
          <SelectTrigger aria-label="Filter by status" className="min-w-32">
            <SelectValue>{(value: StatusFilter) => STATUS_FILTER_LABEL[value] ?? "All statuses"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((key) => (
              <SelectItem key={key} value={key}>
                {STATUS_FILTER_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showScopes && (
          <Select value={accessFilter} onValueChange={(value) => setAccessFilter((value as AccessFilter) ?? FILTER_ALL)}>
            <SelectTrigger aria-label="Filter by access" className="min-w-32">
              <SelectValue>{(value: AccessFilter) => ACCESS_FILTER_LABEL[value] ?? "All access"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ACCESS_FILTER_LABEL) as AccessFilter[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {ACCESS_FILTER_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canCreate && (
          <AddButton
            label="Add member"
            blockedReason={teams.length === 0 ? "Add a team in Organisation first." : undefined}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          />
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={
          members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description={
                canCreate
                  ? teams.length === 0
                    ? "Add a team in Organisation first."
                    : "Add the first member to start tracking your team."
                  : "Ask an admin to assign members to your teams."
              }
            />
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
          title={`Remove manager access to teams for ${clearingScopes?.fullName ?? ""}?`}
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
          title={`Delete member ${confirming?.code ?? ""} · ${confirming?.fullName ?? ""}?`}
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
        {scopes.map((scope) => scope.label).join(", ")}
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
