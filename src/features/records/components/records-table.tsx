"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import type { ComboboxOption } from "@/components/entity-combobox";
import { EXPIRY_STATUSES, expiryMeta } from "@/components/status/expiry";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { NO_TEAM_LABEL } from "@/components/status/labels";
import { ApprovalBadge, CatalogueStatusBadge } from "@/components/status/record-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CERTIFICATE_KIND_LABEL, CERTIFICATE_KIND_NOUN } from "@/features/certificates/schema";
import { inMemberView, MEMBER_VIEW_LABEL, type MemberView } from "@/features/dashboard/member-metrics";
import { deleteRecord, deleteRecords, reviewRecord } from "@/features/records/actions";
import { EvidenceCell } from "@/features/records/components/evidence-cell";
import { RecordSheet } from "@/features/records/components/record-sheet";
import { filterByKind, isApprovedDone, isRecordDeletableByMember, isReviewable, KIND_FILTER_LABEL, KIND_FILTERS, kindCounts, learningPath, type ApprovalState, type KindFilter } from "@/features/records/kind";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import type { RecordRow } from "@/features/records/queries";
import { MAX_BULK_DELETE, reviewSchema } from "@/features/records/schema";
import { formatDate } from "@/lib/format";
import { foldText } from "@/lib/text";

/** A Base UI `Select` value must be a non-empty string, so "no filter" is a sentinel, not "". */
const APPROVAL_FILTER_LABEL: Record<ApprovalState, string> = {
  waiting: "Waiting for approval",
  approved: "Approved",
  returned: "Returned",
};

const ALL = "all";
const ADD_HINT = "Passed an exam or finished a course? Add the certificate with its proof.";
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

/** One click, no dialog; the page refreshes itself through the action's revalidation. */
async function approve(record: RecordRow) {
  const result = await reviewRecord({ id: record.id, decision: "approve" });
  if (!result.ok) toast.error(result.error);
  else toast.success(`Approved ${CERTIFICATE_KIND_NOUN[record.certificateKind]} of ${record.memberName}`);
}

const STICKY_NAME_META = { className: "sticky left-10 z-[1]", cellClassName: "bg-card group-hover:bg-accent" };

export function RecordsTable({
  records,
  memberOptions,
  certificateOptions,
  studyCourses,
  mode,
  canDelete,
  showCompanyFields,
  canAddToCatalogue = false,
  fixedMemberId,
  initialSearch = "",
  initialTeam = "",
  initialView,
  canReview = false,
  reviewerMemberId = null,
  initialApproval = false,
  aiReaderEnabled = false,
}: {
  /** Shows "Fill from file" in the add sheet; see RecordSheet. */
  aiReaderEnabled?: boolean;
  records: RecordRow[];
  memberOptions: ComboboxOption[];
  certificateOptions: CertificateChoice[];
  studyCourses: StudyCourse[];
  /** "self" hides the member/team columns and the team filter. */
  mode: "team" | "self";
  canDelete: boolean;
  showCompanyFields: boolean;
  /** Admin only; see RecordSheet. */
  canAddToCatalogue?: boolean;
  fixedMemberId?: string;
  /** Starting value of the search box (the dashboard links here with ?search=<name>). */
  initialSearch?: string;
  /** Starting value of the Team dropdown (Explorer links here with ?team=<name>). */
  initialTeam?: string;
  /** Narrows the list to one dashboard tile's items (/me?view=...). */
  initialView?: MemberView;
  /** Admin and manager: Approve / Return in the row menu (RLS still decides; the database trigger refuses a member). */
  canReview?: boolean;
  /** The viewer's own member row: a manager never reviews their own item. */
  reviewerMemberId?: string | null;
  /** Opens the list narrowed to items waiting for approval (/records?approval=waiting). */
  initialApproval?: boolean;
}) {
  const isTeam = mode === "team";
  const [search, setSearch] = useState(initialSearch);
  const [teamFilter, setTeamFilter] = useState(
    initialTeam ? (initialTeam === NO_TEAM_LABEL || initialTeam === NO_TEAM ? NO_TEAM : initialTeam) : ALL,
  );
  const [statusFilter, setStatusFilter] = useState(
    initialApproval || initialView === "waiting" ? "waiting" : ALL,
  );
  const [expiryFilter, setExpiryFilter] = useState(ALL);
  const [kindFilter, setKindFilter] = useState<KindFilter>(ALL);
  const [waitingOnly, setWaitingOnly] = useState(initialApproval);
  const [returning, setReturning] = useState<RecordRow | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [view, setView] = useState<MemberView | undefined>(initialView);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Keep the id, not the row: the sheet must see the refreshed row (e.g. `hasEvidence`) after a server action revalidates.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<RecordRow | null>(null);
  const [pending, setPending] = useState(false);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [bulkConfirming, setBulkConfirming] = useState(false);

  const editing = useMemo(() => records.find((record) => record.id === editingId) ?? null, [records, editingId]);
  const teamNames = useMemo(
    () => [...new Set(records.flatMap((record) => (record.teamName ? [record.teamName] : [])))].sort((a, b) => a.localeCompare(b, "vi")),
    [records],
  );
  const hasTeamless = useMemo(() => records.some((record) => record.teamId === null), [records]);

  const counts = useMemo(() => kindCounts(records), [records]);
  const waitingCount = useMemo(() => records.filter((record) => isReviewable(record, reviewerMemberId)).length, [records, reviewerMemberId]);

  const hasActiveFilters =
    search.length > 0 ||
    teamFilter !== ALL ||
    statusFilter !== ALL ||
    expiryFilter !== ALL ||
    kindFilter !== ALL ||
    waitingOnly ||
    view !== undefined;

  const rows = useMemo(() => {
    const query = foldText(search);
    return filterByKind(records, kindFilter).filter((record) => {
      if (view && !inMemberView(record, view)) return false;
      if (waitingOnly && !isReviewable(record, reviewerMemberId)) return false;
      if (query) {
        const haystack = foldText(
          isTeam
            ? `${record.memberName} ${record.memberCode} ${record.teamName ?? ""} ${record.certificateName} ${record.certTypeName ?? ""} ${record.courseName ?? ""} ${record.providerName ?? ""}`
            : `${record.certificateName} ${record.certTypeName ?? ""} ${record.courseName ?? ""} ${record.providerName ?? ""}`,
        );
        if (!haystack.includes(query)) return false;
      }
      if (isTeam && teamFilter !== ALL) {
        if (teamFilter === NO_TEAM ? record.teamId !== null : record.teamName !== teamFilter) return false;
      }
      if (statusFilter !== ALL && record.approval !== statusFilter) return false;
      if (expiryFilter !== ALL && record.expiryStatus !== expiryFilter) return false;
      return true;
    });
  }, [records, search, isTeam, teamFilter, statusFilter, expiryFilter, kindFilter, view, waitingOnly, reviewerMemberId]);

  function openEdit(id: string) {
    setEditingId(id);
    setSheetOpen(true);
  }

  // With a checkbox column in front, the name column sticks right after it (2.5rem); alone, DataTable's `first:` rule applies.
  const stickyName = canDelete ? STICKY_NAME_META : undefined;

  // Selection only counts rows the filters still show, so a hidden row is never deleted by a bulk action.
  const selectedIds = useMemo(() => rows.filter((row) => selection[row.id]).map((row) => row.id), [rows, selection]);
  const tooManySelected = selectedIds.length > MAX_BULK_DELETE;

  // Memoised: react-table renders each `cell` function as a component, so a fresh `columns` array on every render
  // gives every cell a new component type and remounts it. That closed an open row menu on each Realtime refresh.
  // The cells close over `canDelete` and the stable useState setters only, so these two deps are complete.
  const columns = useMemo<ColumnDef<RecordRow, unknown>[]>(
    () => [
      ...(canDelete
        ? ([
            {
              id: "select",
              enableSorting: false,
              header: ({ table }) => (
                <Checkbox
                  aria-label="Select all on this page"
                  checked={table.getIsAllPageRowsSelected()}
                  indeterminate={table.getIsSomePageRowsSelected()}
                  onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                />
              ),
              cell: ({ row }) => (
                <Checkbox
                  aria-label={`Select ${row.original.memberName} · ${row.original.certificateName}`}
                  checked={row.getIsSelected()}
                  onCheckedChange={(checked) => row.toggleSelected(checked)}
                />
              ),
              meta: { className: "w-10 min-w-10 max-w-10" },
            },
          ] satisfies ColumnDef<RecordRow, unknown>[])
        : []),
      ...(isTeam
        ? ([
            {
              accessorKey: "memberName",
              header: "Full name",
              cell: ({ row }) => (
                <div className="flex min-w-32 flex-col items-start">
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => openEdit(row.original.id)}>
                    {row.original.memberName}
                  </button>
                  <span className="text-caption text-muted-foreground">{row.original.memberCode}</span>
                </div>
              ),
              meta: stickyName,
            },
            { accessorKey: "teamName", header: "Team", cell: ({ row }) => row.original.teamName ?? "—" },
          ] satisfies ColumnDef<RecordRow, unknown>[])
        : []),
      {
        accessorKey: "certificateName",
        header: "Certificate",
        cell: ({ row }) => (
          // Name alone on the first line so it gets the width; kind, proposal state and path go underneath.
          <div className="flex max-w-md flex-col gap-0.5">
            <span className="flex min-w-0">
              {isTeam ? (
                <span className="truncate" title={row.original.certificateName}>
                  {row.original.certificateName}
                </span>
              ) : (
                <button
                  type="button"
                  className="truncate text-left font-medium hover:underline"
                  title={row.original.certificateName}
                  onClick={() => openEdit(row.original.id)}
                >
                  {row.original.certificateName}
                </button>
              )}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Badge variant="secondary" className="shrink-0 rounded-sm">
                {CERTIFICATE_KIND_LABEL[row.original.certificateKind]}
              </Badge>
              <CatalogueStatusBadge status={row.original.certificateCatalogueStatus} />
              {learningPath(row.original) && (
                <span className="truncate text-caption text-muted-foreground" title={learningPath(row.original) ?? undefined}>
                  {learningPath(row.original)}
                </span>
              )}
            </span>
          </div>
        ),
        meta: isTeam ? undefined : stickyName,
      },
      {
        accessorKey: "approval",
        header: "Status",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {/* A certificate is a result (decision #72): only its approval changes. Expiry has its own column. */}
            <ApprovalBadge approval={row.original.approval} />
          </span>
        ),
      },
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
            kind={row.original.certificateKind}
            counted={row.original.status !== "done" || isApprovedDone(row.original)}
          />
        ),
      },
      {
        accessorKey: "issuedDate",
        header: "Issued date",
        cell: ({ row }) => (row.original.issuedDate ? formatDate(row.original.issuedDate) : "—"),
      },
      {
        id: "evidence",
        header: "Evidence",
        enableSorting: false,
        cell: ({ row }) => <EvidenceCell record={row.original} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { className: "sticky right-0 z-[1] w-10", cellClassName: "bg-card group-hover:bg-accent" },
        cell: ({ row }) => {
          const record = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-my-1"
                    aria-label={`Actions for ${record.memberName} · ${record.certificateName}`}
                  />
                }
              >
                <MoreHorizontal aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onClick={() => openEdit(record.id)}>Edit</DropdownMenuItem>
                {record.hasEvidence && (
                  <DropdownMenuItem
                    render={<a href={`/api/records/${record.id}/evidence`} target="_blank" rel="noopener noreferrer" />}
                  >
                    View evidence
                  </DropdownMenuItem>
                )}
                {canReview && record.status === "done" && !record.renewed && record.memberId !== reviewerMemberId && record.approval !== "approved" && (
                  <DropdownMenuItem onClick={() => void approve(record)}>
                    Approve{" "}
                    {!record.hasEvidence && !record.certificateUrl && (
                      <span className="ml-auto text-caption text-muted-foreground">No proof</span>
                    )}
                  </DropdownMenuItem>
                )}
                {canReview && isReviewable(record, reviewerMemberId) && (
                  <DropdownMenuItem
                    onClick={() => {
                      setReturnNote("");
                      setReturnError(null);
                      setReturning(record);
                    }}
                  >
                    Return
                  </DropdownMenuItem>
                )}
                {(canDelete || isRecordDeletableByMember(record)) && (
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
    [isTeam, canDelete, canReview, reviewerMemberId, kindFilter, stickyName, mode, showCompanyFields],
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
    toast.success(`Deleted ${CERTIFICATE_KIND_NOUN[confirming.certificateKind]}`);
    setConfirming(null);
  }

  async function handleReturn() {
    if (!returning) return;
    const parsed = reviewSchema.safeParse({ id: returning.id, decision: "return", note: returnNote });
    if (!parsed.success) {
      setReturnError(parsed.error.issues[0]?.message ?? "Invalid data");
      return;
    }
    setPending(true);
    const result = await reviewRecord(parsed.data);
    setPending(false);
    if (!result.ok) {
      setReturnError(result.error);
      return;
    }
    toast.success(`Returned ${CERTIFICATE_KIND_NOUN[returning.certificateKind]} to ${returning.memberName}`);
    setReturning(null);
  }

  async function handleBulkDelete() {
    setPending(true);
    const result = await deleteRecords({ ids: selectedIds });
    setPending(false);
    setBulkConfirming(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSelection({});
    // The action already revalidated the page, so the rows that did go disappear on their own.
    const { count } = result.data;
    if (count < selectedIds.length) {
      toast.warning(`Deleted ${count} of ${selectedIds.length} items. The rest were already gone or you can't delete them.`);
    } else {
      toast.success(`Deleted ${count} ${count === 1 ? "item" : "items"}`);
    }
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
        searchPlaceholder={isTeam ? "Search by name, code, certificate or course…" : "Search by certificate or course…"}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setTeamFilter(ALL);
          setStatusFilter(ALL);
          setExpiryFilter(ALL);
          setKindFilter(ALL);
          setWaitingOnly(false);
          setView(undefined);
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
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value ?? ALL);
            setWaitingOnly(false);
            setView(undefined);
          }}
        >
          <SelectTrigger aria-label="Status">
            <SelectValue>
              {(value: string) => (value === ALL ? "All statuses" : (APPROVAL_FILTER_LABEL[value as ApprovalState] ?? value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {(Object.keys(APPROVAL_FILTER_LABEL) as ApprovalState[]).map((state) => (
              <SelectItem key={state} value={state}>
                {APPROVAL_FILTER_LABEL[state]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={expiryFilter}
          onValueChange={(value) => {
            setExpiryFilter(value ?? ALL);
            setView(undefined);
          }}
        >
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
            {EXPIRY_STATUSES.filter((status) => status !== "N/A").map((status) => (
              <SelectItem key={status} value={status}>
                {expiryMeta(status).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canReview && (
          <Button
            size="sm"
            variant={waitingOnly ? "secondary" : "outline"}
            aria-pressed={waitingOnly}
            onClick={() => {
              const next = !waitingOnly;
              setWaitingOnly(next);
              setStatusFilter(next ? "waiting" : ALL);
            }}
          >
            {`Waiting for approval (${waitingCount})`}
          </Button>
        )}
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
          Add certificate
        </Button>
      </FilterBar>
      {view && (
        <p className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <span>
            Showing <strong className="font-medium text-foreground">{MEMBER_VIEW_LABEL[view]}</strong> only
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (view === "waiting") setStatusFilter(ALL);
              setView(undefined);
            }}
          >
            Show all
          </Button>
        </p>
      )}
      {!isTeam && <p className="text-caption text-muted-foreground">{ADD_HINT}</p>}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-1.5 text-table" role="region" aria-label="Bulk actions">
          <span>{selectedIds.length} selected</span>
          <Button size="sm" variant="destructive" disabled={tooManySelected} onClick={() => setBulkConfirming(true)}>
            Delete
          </Button>
          {tooManySelected && <span className="text-caption text-muted-foreground">Select up to {MAX_BULK_DELETE} to delete.</span>}
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
            Clear selection
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        onRowClick={(row) => openEdit(row.id)}
        rowSelection={canDelete ? selection : undefined}
        onRowSelectionChange={canDelete ? setSelection : undefined}
        empty={
          records.length === 0 ? (
            <EmptyState
              title="Nothing added yet"
              description={
                isTeam
                  ? "Add a member's exam certificate or course certificate."
                  : "Add an exam certificate or course certificate you hold."
              }
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
        canAddToCatalogue={canAddToCatalogue}
        fixedMemberId={fixedMemberId}
        viewerMemberId={reviewerMemberId ?? fixedMemberId}
        canDelete={canDelete}
        aiReaderEnabled={aiReaderEnabled}
        records={records}
        onEditExisting={(record) => {
          setEditingId(record.id);
        }}
      />
      {canReview && (
        <ConfirmDialog
          open={!!returning}
          onOpenChange={(open) => !open && setReturning(null)}
          title={returning ? `Return the ${returning.certificateName} ${CERTIFICATE_KIND_NOUN[returning.certificateKind]} of ${returning.memberName}?` : ""}
          description="It goes back to the member with your note and stays out of the numbers until you approve it."
          confirmLabel="Return"
          pendingLabel="Returning…"
          variant="default"
          pending={pending}
          onConfirm={handleReturn}
        >
          <Field data-invalid={!!returnError}>
            <FieldLabel htmlFor="return-note">What should the member fix?</FieldLabel>
            <Textarea
              id="return-note"
              value={returnNote}
              maxLength={2000}
              aria-invalid={!!returnError}
              onChange={(event) => {
                setReturnNote(event.target.value);
                setReturnError(null);
              }}
            />
            <FieldError errors={returnError ? [{ message: returnError }] : []} />
          </Field>
        </ConfirmDialog>
      )}
      {canDelete && (
        <ConfirmDialog
          open={bulkConfirming}
          onOpenChange={setBulkConfirming}
          title={`Delete ${selectedIds.length} selected ${selectedIds.length === 1 ? "item" : "items"}?`}
          description="The selected items and their evidence files will be deleted. This cannot be undone."
          confirmLabel={`Delete ${selectedIds.length} ${selectedIds.length === 1 ? "item" : "items"}`}
          pendingLabel="Deleting…"
          pending={pending}
          onConfirm={handleBulkDelete}
        />
      )}
      {/* Members delete their own drafts and returned items from the row menu too, so this is not gated by canDelete. */}
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? `Delete the ${confirming.certificateName} ${CERTIFICATE_KIND_NOUN[confirming.certificateKind]} of ${confirming.memberName}?` : ""}
        description={`The ${confirming ? CERTIFICATE_KIND_NOUN[confirming.certificateKind] : "certificate"} and its evidence file will be deleted. This cannot be undone.`}
        confirmLabel={`Delete ${confirming ? CERTIFICATE_KIND_NOUN[confirming.certificateKind] : "certificate"}`}
        pendingLabel="Deleting…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
