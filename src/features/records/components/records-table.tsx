"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import type { ComboboxOption } from "@/components/entity-combobox";
import { EXPIRY_STATUSES, expiryMeta } from "@/components/status/expiry";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { RECORD_STATUS_LABEL } from "@/components/status/labels";
import { MemberCode } from "@/components/status/member-code";
import { ProgressInline } from "@/components/status/progress-inline";
import { RecordStatusLabel } from "@/components/status/record-status";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteRecord } from "@/features/records/actions";
import { RecordSheet } from "@/features/records/components/record-sheet";
import type { RecordRow } from "@/features/records/queries";
import { RECORD_STATUSES } from "@/features/records/schema";
import { formatDate } from "@/lib/format";
import { foldText } from "@/lib/text";

/** A Base UI `Select` value must be a non-empty string, so "no filter" is a sentinel, not "". */
const ALL = "all";
/** Team filter value for rows without a team (`teamId === null`). */
const NO_TEAM = "__no_team__";

/** Ascending by days left; a record with no expiry date (`null`) always sorts after the dated ones. */
function byDaysToExpiry(
  a: { getValue: <T>(id: string) => T },
  b: { getValue: <T>(id: string) => T },
  columnId: string,
): number {
  const x = a.getValue<number | null>(columnId);
  const y = b.getValue<number | null>(columnId);
  if (x === y) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x - y;
}

export function RecordsTable({
  records,
  memberOptions,
  courseOptions,
  mode,
  canDelete,
  showCompanyFields,
  fixedMemberId,
}: {
  records: RecordRow[];
  memberOptions: ComboboxOption[];
  courseOptions: ComboboxOption[];
  /** "self" hides the member/team columns and the team filter. */
  mode: "team" | "self";
  canDelete: boolean;
  showCompanyFields: boolean;
  fixedMemberId?: string;
}) {
  const isTeam = mode === "team";
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [expiryFilter, setExpiryFilter] = useState(ALL);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Keep the id, not the row: the sheet must see the refreshed row (e.g. `hasEvidence`) after a server action revalidates.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<RecordRow | null>(null);
  const [pending, setPending] = useState(false);

  const editing = useMemo(() => records.find((record) => record.id === editingId) ?? null, [records, editingId]);
  const teamNames = useMemo(
    () => [...new Set(records.flatMap((record) => (record.teamName ? [record.teamName] : [])))].sort((a, b) => a.localeCompare(b, "vi")),
    [records],
  );
  const hasTeamless = useMemo(() => records.some((record) => record.teamId === null), [records]);

  const hasActiveFilters =
    search.length > 0 || teamFilter !== ALL || statusFilter !== ALL || expiryFilter !== ALL;

  const rows = useMemo(() => {
    const query = foldText(search);
    return records.filter((record) => {
      if (query) {
        const haystack = foldText(
          `${record.memberName} ${record.memberCode} ${record.courseName} ${record.providerName ?? ""}`,
        );
        if (!haystack.includes(query)) return false;
      }
      if (isTeam && teamFilter !== ALL) {
        if (teamFilter === NO_TEAM ? record.teamId !== null : record.teamName !== teamFilter) return false;
      }
      if (statusFilter !== ALL && record.status !== statusFilter) return false;
      if (expiryFilter !== ALL && record.expiryStatus !== expiryFilter) return false;
      return true;
    });
  }, [records, search, isTeam, teamFilter, statusFilter, expiryFilter]);

  // Memoised: react-table renders each `cell` function as a component, so a fresh `columns` array on every render
  // gives every cell a new component type and remounts it. That closed an open row menu on each Realtime refresh.
  // The cells close over `canDelete` and the stable useState setters only, so these two deps are complete.
  const columns = useMemo<ColumnDef<RecordRow, unknown>[]>(
    () => [
      ...(isTeam
        ? ([
            { accessorKey: "memberCode", header: "Mã", cell: ({ row }) => <MemberCode code={row.original.memberCode} /> },
            { accessorKey: "memberName", header: "Họ tên" },
            { accessorKey: "teamName", header: "Team", cell: ({ row }) => row.original.teamName ?? "—" },
          ] satisfies ColumnDef<RecordRow, unknown>[])
        : []),
      {
        accessorKey: "courseName",
        header: "Khóa học",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.courseName}</span>
            {row.original.providerName && (
              <span className="text-caption text-muted-foreground">{row.original.providerName}</span>
            )}
          </div>
        ),
      },
      { accessorKey: "status", header: "Trạng thái", cell: ({ row }) => <RecordStatusLabel status={row.original.status} /> },
      { accessorKey: "progress", header: "Tiến độ", cell: ({ row }) => <ProgressInline value={row.original.progress} /> },
      {
        id: "expiry",
        header: "Hạn",
        accessorFn: (record) => record.daysToExpiry,
        sortingFn: byDaysToExpiry,
        // Numeric columns default to descending first; "soonest expiry first" is the useful first click.
        sortDescFirst: false,
        cell: ({ row }) => (
          <ExpiryBadge
            status={row.original.expiryStatus}
            daysToExpiry={row.original.daysToExpiry}
            expiryDate={row.original.expiryDate}
          />
        ),
      },
      {
        accessorKey: "plannedExamDate",
        header: "Ngày thi",
        cell: ({ row }) => (row.original.plannedExamDate ? formatDate(row.original.plannedExamDate) : "—"),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const record = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Thao tác cho ${record.memberName} · ${record.courseName}`}
                  />
                }
              >
                <MoreHorizontal aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingId(record.id);
                    setSheetOpen(true);
                  }}
                >
                  Sửa
                </DropdownMenuItem>
                {record.hasEvidence && (
                  <DropdownMenuItem
                    render={<a href={`/api/records/${record.id}/evidence`} target="_blank" rel="noopener noreferrer" />}
                  >
                    Xem minh chứng
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirming(record)}>
                    Xóa
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [isTeam, canDelete],
  );

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteRecord({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success("Đã xóa chứng chỉ");
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isTeam ? "Tìm theo tên, mã, khóa học…" : "Tìm theo khóa học…"}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setTeamFilter(ALL);
          setStatusFilter(ALL);
          setExpiryFilter(ALL);
        }}
      >
        {isTeam && (
          <Select value={teamFilter} onValueChange={(value) => setTeamFilter(value ?? ALL)}>
            <SelectTrigger aria-label="Team">
              <SelectValue>
                {(value: string) => (value === ALL ? "Tất cả team" : value === NO_TEAM ? "Chưa có team" : value)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả team</SelectItem>
              {teamNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
              {hasTeamless && <SelectItem value={NO_TEAM}>Chưa có team</SelectItem>}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL)}>
          <SelectTrigger aria-label="Trạng thái">
            <SelectValue>
              {(value: string) =>
                value === ALL ? "Tất cả trạng thái" : (RECORD_STATUS_LABEL[value as keyof typeof RECORD_STATUS_LABEL] ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tất cả trạng thái</SelectItem>
            {RECORD_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {RECORD_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={expiryFilter} onValueChange={(value) => setExpiryFilter(value ?? ALL)}>
          <SelectTrigger aria-label="Hạn">
            <SelectValue>
              {(value: string) =>
                value === ALL
                  ? "Tất cả hạn"
                  : (EXPIRY_STATUSES.find((status) => status === value) ?? null) !== null
                    ? expiryMeta(value as (typeof EXPIRY_STATUSES)[number]).label
                    : value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tất cả hạn</SelectItem>
            {EXPIRY_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {expiryMeta(status).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="ml-auto"
          disabled={courseOptions.length === 0 || (isTeam && memberOptions.length === 0)}
          onClick={() => {
            setEditingId(null);
            setSheetOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm chứng chỉ
        </Button>
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={
          records.length === 0 ? (
            <EmptyState title="Chưa có chứng chỉ nào" description="Thêm chứng chỉ đầu tiên để bắt đầu theo dõi." />
          ) : (
            <EmptyState title="Không tìm thấy chứng chỉ" description="Thử từ khóa khác hoặc xóa bộ lọc." />
          )
        }
      />
      <RecordSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        memberOptions={memberOptions}
        courseOptions={courseOptions}
        showCompanyFields={showCompanyFields}
        fixedMemberId={fixedMemberId}
      />
      {canDelete && (
        <ConfirmDialog
          open={!!confirming}
          onOpenChange={(open) => !open && setConfirming(null)}
          title={`Xóa chứng chỉ ${confirming?.courseName} của ${confirming?.memberName}?`}
          description="Bản ghi và tệp minh chứng sẽ bị xóa. Không thể hoàn tác."
          confirmLabel="Xóa chứng chỉ"
          pendingLabel="Đang xóa…"
          pending={pending}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
