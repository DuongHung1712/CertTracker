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
import { deleteMember } from "@/features/members/actions";
import { MemberDialog } from "@/features/members/components/member-dialog";

type Member = {
  id: string;
  code: string;
  fullName: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  isActive: boolean;
};
type TeamOption = { id: string; name: string };

export function MembersTable({
  members,
  teams,
  canCreate,
  canDelete,
}: {
  members: Member[];
  teams: TeamOption[];
  canCreate: boolean;
  canDelete: boolean;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirming, setConfirming] = useState<Member | null>(null);
  const [pending, setPending] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.code} ${m.fullName} ${m.email}`.toLowerCase().includes(q));
  }, [members, search]);

  const columns: ColumnDef<Member, unknown>[] = [
    { accessorKey: "code", header: "Mã", cell: ({ row }) => <MemberCode code={row.original.code} /> },
    { accessorKey: "fullName", header: "Họ tên" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "teamName", header: "Team", cell: ({ row }) => row.original.teamName ?? "—" },
    {
      accessorKey: "isActive",
      header: "Trạng thái",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="secondary" className="rounded-sm">
            Đang hoạt động
          </Badge>
        ) : (
          <span className="text-caption text-muted-foreground">Ngừng hoạt động</span>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Thao tác cho ${row.original.fullName}`} />}>
            <MoreHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original);
                setDialogOpen(true);
              }}
            >
              Sửa
            </DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirming(row.original)}>
                Xóa
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
    toast.success(`Đã xóa thành viên ${confirming.fullName}`);
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã, email…"
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
            Thêm thành viên
          </Button>
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Không tìm thấy thành viên" description="Thử từ khóa khác hoặc xóa bộ lọc." />}
      />
      <MemberDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} teams={teams} />
      {canDelete && (
        <ConfirmDialog
          open={!!confirming}
          onOpenChange={(open) => !open && setConfirming(null)}
          title={`Xóa thành viên ${confirming?.code} · ${confirming?.fullName}?`}
          description="Chỉ xóa được khi thành viên chưa có bản ghi chứng chỉ nào. Không thể hoàn tác."
          confirmLabel="Xóa thành viên"
          pendingLabel="Đang xóa…"
          pending={pending}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
