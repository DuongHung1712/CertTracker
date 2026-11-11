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
import { NO_TEAM_LABEL, RECORD_STATUS_LABEL } from "@/components/status/labels";
import { MemberCode } from "@/components/status/member-code";
import { ProgressInline } from "@/components/status/progress-inline";
import { RecordStatusLabel } from "@/components/status/record-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CERTIFICATE_KIND_LABEL, CERTIFICATE_KIND_NOUN } from "@/features/certificates/schema";
import { deleteRecord } from "@/features/records/actions";
import { RecordSheet } from "@/features/records/components/record-sheet";
import { filterByKind, KIND_FILTER_LABEL, KIND_FILTERS, kindCounts, plannedDateHeader, type KindFilter } from "@/features/records/kind";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import type { RecordRow } from "@/features/records/queries";
import { RECORD_STATUSES } from "@/features/records/schema";
import { formatDate } from "@/lib/format";
import { foldText } from "@/lib/text";

/** A Base UI `Select` value must be a non-empty string, so "no filter" is a sentinel, not "". */
const ALL = "all";
const ADD_HINT = "Studying for an exam? Choose the exam, then the course you used.";
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
  certificateOptions,
  studyCourses,
  mode,
  canDelete,
  showCompanyFields,
  fixedMemberId,
  initialSearch = "",
}: {
  records: RecordRow[];
  memberOptions: ComboboxOption[];
  certificateOptions: CertificateChoice[];
  studyCourses: StudyCourse[];
  /** "self" hides the member/team columns and the team filter. */
  mode: "team" | "self";
  canDelete: boolean;
  showCompanyFields: boolean;
  fixedMemberId?: string;
  /** Starting value of the search box (the dashboard links here with ?search=<name>). */
  initialSearch?: string;
}) {
  const isTeam = mode === "team";
  const [search, setSearch] = useState(initialSearch);
  const [teamFilter, setTeamFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [expiryFilter, setExpiryFilter] = useState(ALL);
  const [kindFilter, setKindFilter] = useState<KindFilter>(ALL);
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

  const counts = useMemo(() => kindCounts(records), [records]);

  const hasActiveFilters =
    search.length > 0 || teamFilter !== ALL || statusFilter !== ALL || expiryFilter !== ALL || kindFilter !== ALL;

  const rows = useMemo(() => {
    const query = foldText(search);
    return filterByKind(records, kindFilter).filter((record) => {
      if (query) {
        const haystack = foldText(
          `${record.memberName} ${record.memberCode} ${record.certificateName} ${record.courseName ?? ""} ${record.providerName ?? ""}`,
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
  }, [records, search, isTeam, teamFilter, statusFilter, expiryFilter, kindFilter]);

  // Memoised: react-table renders each `cell` function as a component, so a fresh `columns` array on every render
  // gives every cell a new component type and remounts it. That closed an open row menu on each Realtime refresh.
  // The cells close over `canDelete` and the stable useState setters only, so these two deps are complete.
  const columns = useMemo<ColumnDef<RecordRow, unknown>[]>(
    () => [
      ...(isTeam
        ? ([
            { accessorKey: "memberCode", header: "Code", cell: ({ row }) => <MemberCode code={row.original.memberCode} /> },
            { accessorKey: "memberName", header: "Full name" },
            { accessorKey: "teamName", header: "Team", cell: ({ row }) => row.original.teamName ?? "—" },
          ] satisfies ColumnDef<RecordRow, unknown>[])
        : []),
      {
        accessorKey: "certificateName",
        header: "Certificate",
        cell: ({ row }) => (
          <div className="flex max-w-60 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate" title={row.original.certificateName}>
                {row.original.certificateName}
              </span>
              <Badge variant="secondary" className="shrink-0 rounded-sm">
                {CERTIFICATE_KIND_LABEL[row.original.certificateKind]}
              </Badge>
            </span>
            {row.original.providerName && (
              <span className="text-caption text-muted-foreground">{row.original.providerName}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "courseName",
        header: "Course studied",
        cell: ({ row }) => (
          <span className="block max-w-40 truncate" title={row.original.courseName ?? undefined}>
            {row.original.courseName ?? "—"}
          </span>
        ),
        meta: { className: "hidden xl:table-cell" },
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <RecordStatusLabel status={row.original.status} /> },
      { accessorKey: "progress", header: "Progress", cell: ({ row }) => <ProgressInline value={row.original.progress} /> },
      {
        id: "expiry",
        header: "Expiry",
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
        header: plannedDateHeader(kindFilter),
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
                    aria-label={`Actions for ${record.memberName} · ${record.certificateName}`}
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
                  Edit
                </DropdownMenuItem>
                {record.hasEvidence && (
                  <DropdownMenuItem
                    render={<a href={`/api/records/${record.id}/evidence`} target="_blank" rel="noopener noreferrer" />}
                  >
                    View evidence
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirming(record)}>
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [isTeam, canDelete, kindFilter],
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
    toast.success("Deleted certificate");
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {!isTeam && records.length > 0 && (
        <Tabs value={kindFilter} onValueChange={(value) => setKindFilter(value as KindFilter)}>
          <TabsList className="flex w-full flex-wrap gap-1 group-data-horizontal/tabs:h-auto">
            {KIND_FILTERS.map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {`${KIND_FILTER_LABEL[kind]} (${counts[kind]})`}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isTeam ? "Search by name, code or certificate…" : "Search by certificate…"}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setTeamFilter(ALL);
          setStatusFilter(ALL);
          setExpiryFilter(ALL);
          setKindFilter(ALL);
        }}
      >
        {isTeam && (
          <Select value={teamFilter} onValueChange={(value) => setTeamFilter(value ?? ALL)}>
            <SelectTrigger aria-label="Team">
              <SelectValue>
                {(value: string) => (value === ALL ? "All teams" : value === NO_TEAM ? NO_TEAM_LABEL : value)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {teamNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
              {hasTeamless && <SelectItem value={NO_TEAM}>{NO_TEAM_LABEL}</SelectItem>}
            </SelectContent>
          </Select>
        )}
        {isTeam && (
          <Select value={kindFilter} onValueChange={(value) => setKindFilter((value as KindFilter | null) ?? ALL)}>
            <SelectTrigger aria-label="Kind">
              <SelectValue>{(value: KindFilter) => (value === ALL ? "All kinds" : KIND_FILTER_LABEL[value])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All kinds</SelectItem>
              {KIND_FILTERS.filter((kind) => kind !== ALL).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {KIND_FILTER_LABEL[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL)}>
          <SelectTrigger aria-label="Status">
            <SelectValue>
              {(value: string) =>
                value === ALL ? "All statuses" : (RECORD_STATUS_LABEL[value as keyof typeof RECORD_STATUS_LABEL] ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {RECORD_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {RECORD_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={expiryFilter} onValueChange={(value) => setExpiryFilter(value ?? ALL)}>
          <SelectTrigger aria-label="Expiry">
            <SelectValue>
              {(value: string) =>
                value === ALL
                  ? "All expiry statuses"
                  : (EXPIRY_STATUSES.find((status) => status === value) ?? null) !== null
                    ? expiryMeta(value as (typeof EXPIRY_STATUSES)[number]).label
                    : value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All expiry statuses</SelectItem>
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
          disabled={certificateOptions.length === 0 || (isTeam && memberOptions.length === 0)}
          onClick={() => {
            setEditingId(null);
            setSheetOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Add certificate or course completion
        </Button>
      </FilterBar>
      {!isTeam && <p className="text-caption text-muted-foreground">{ADD_HINT}</p>}
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={
          records.length === 0 ? (
            <EmptyState
              title="Nothing added yet"
              description="Add a certificate you hold, a course you are studying or a course completion."
            />
          ) : (
            <EmptyState title="Nothing found" description="Try a different search or clear the filters." />
          )
        }
      />
      <RecordSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        memberOptions={memberOptions}
        certificateOptions={certificateOptions}
        studyCourses={studyCourses}
        showCompanyFields={showCompanyFields}
        fixedMemberId={fixedMemberId}
      />
      {canDelete && (
        <ConfirmDialog
          open={!!confirming}
          onOpenChange={(open) => !open && setConfirming(null)}
          title={confirming ? `Delete the ${confirming.certificateName} ${CERTIFICATE_KIND_NOUN[confirming.certificateKind]} of ${confirming.memberName}?` : ""}
          description={`The ${confirming ? CERTIFICATE_KIND_NOUN[confirming.certificateKind] : "certificate"} and its evidence file will be deleted. This cannot be undone.`}
          confirmLabel="Delete certificate"
          pendingLabel="Deleting…"
          pending={pending}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
