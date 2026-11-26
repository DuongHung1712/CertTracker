"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddButton } from "@/components/data/add-button";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { rowActionsColumn } from "@/components/data/row-actions-column";
import { useConfirmedDelete } from "@/components/data/use-confirmed-delete";
import type { ComboboxOption } from "@/components/entity-combobox";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { NO_TEAM_LABEL, RECORD_STATUS_LABEL } from "@/components/status/labels";
import { CatalogueStatusBadge, RecordStatusLabel } from "@/components/status/record-status";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { deleteLearningItem } from "@/features/learning/actions";
import { LearningSheet } from "@/features/learning/components/learning-sheet";
import { SubmitCertificate } from "@/features/learning/components/submit-certificate";
import type { CourseOption, LearningRow } from "@/features/learning/queries";
import type { CertificateChoice } from "@/features/records/certificate-course";
import type { RecordRow } from "@/features/records/queries";
import { RECORD_STATUSES } from "@/features/records/schema";
import { formatDate } from "@/lib/format";
import { foldText } from "@/lib/text";

const ALL = "all";
const NO_TEAM = "__no_team__";
const STATUS_FILTER: SelectOption[] = [{ id: ALL, name: "All statuses" }, ...RECORD_STATUSES.map((status) => ({ id: status, name: RECORD_STATUS_LABEL[status] }))];

// The goal leads (decision #72): the exam when there is one, else the course; the course is how you prepare.
const itemName = (row: LearningRow): string => row.targetCertificateName ?? row.courseName ?? "Untitled";

/** The journey list (decision #72): courses and exams being prepared for. Never approved, no evidence. */
export function LearningTable({
  rows,
  mode,
  fixedMemberId,
  memberOptions = [],
  courses,
  examOptions,
  viewerMemberId = null,
  certificateOptions = [],
  providers,
  showCompanyFields = false,
  canAddToCatalogue = false,
  canDelete = false,
  aiReaderEnabled = false,
  records,
  initialSearch = "",
  initialStatus = ALL,
  initialTeam = "",
}: {
  rows: LearningRow[];
  mode: "self" | "team";
  fixedMemberId?: string;
  memberOptions?: ComboboxOption[];
  courses: CourseOption[];
  examOptions: ComboboxOption[];
  /** The signed-in member, who proposes a missing course; null for an admin. */
  viewerMemberId?: string | null;
  /** For "Add certificate": the certificate sheet needs the catalogue. */
  certificateOptions?: CertificateChoice[];
  providers?: { id: string; name: string }[];
  showCompanyFields?: boolean;
  canAddToCatalogue?: boolean;
  canDelete?: boolean;
  aiReaderEnabled?: boolean;
  records?: RecordRow[];
  /** Links open the list already searched (?search=<name>). */
  initialSearch?: string;
  /** Links open the list narrowed to one status (?status=in_progress | not_started). */
  initialStatus?: string;
  /** Links open the team list narrowed to one team (?team=<name>). */
  initialTeam?: string;
}) {
  const [submitting, setSubmitting] = useState<LearningRow | null>(null);
  // A course's completion certificate (catalogue: certificates.course_id), for "Submit certificate".
  const completionByCourse = useMemo(
    () => new Map(certificateOptions.flatMap((c) => (c.kind === "completion" && c.grantingCourse ? [[c.grantingCourse.id, c.id] as const] : []))),
    [certificateOptions],
  );
  const [search, setSearch] = useState(initialSearch);
  const seedStatus = (RECORD_STATUSES as readonly string[]).includes(initialStatus) ? initialStatus : ALL;
  const [status, setStatus] = useState(seedStatus);
  // Re-seed when real navigation changes ?status= (a key would remount the table on every router.refresh()).
  const [prevSeed, setPrevSeed] = useState(seedStatus);
  if (prevSeed !== seedStatus) {
    setPrevSeed(seedStatus);
    setStatus(seedStatus);
  }
  const [teamFilter, setTeamFilter] = useState(
    initialTeam ? (initialTeam === NO_TEAM_LABEL || initialTeam === NO_TEAM ? NO_TEAM : initialTeam) : ALL,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LearningRow | null>(null);
  const remove = useConfirmedDelete<LearningRow>({
    remove: (row) => deleteLearningItem({ id: row.id }),
    successMessage: (row) => `Removed ${itemName(row)}`,
  });

  function syncSelfStatusUrl(nextStatus: string) {
    if (mode !== "self" || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextStatus !== ALL) url.searchParams.set("status", nextStatus);
    else url.searchParams.delete("status");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  const teamOptions = useMemo<SelectOption[]>(() => {
    const names = [...new Set(rows.flatMap((row) => (row.teamName ? [row.teamName] : [])))].sort((a, b) => a.localeCompare(b, "vi"));
    const hasTeamless = rows.some((row) => row.teamId === null);
    return [
      { id: ALL, name: "All teams" },
      ...names.map((name) => ({ id: name, name })),
      ...(hasTeamless ? [{ id: NO_TEAM, name: NO_TEAM_LABEL }] : []),
    ];
  }, [rows]);

  const visible = useMemo(() => {
    const query = foldText(search.trim());
    return rows.filter((row) => {
      if (status !== ALL && row.status !== status) return false;
      if (mode === "team" && teamFilter !== ALL) {
        if (teamFilter === NO_TEAM ? row.teamId !== null : row.teamName !== teamFilter) return false;
      }
      if (!query) return true;
      return foldText(
        mode === "team"
          ? `${row.courseName ?? ""} ${row.targetCertificateName ?? ""} ${row.providerName ?? ""} ${row.memberName} ${row.memberCode} ${row.teamName ?? ""}`
          : `${row.courseName ?? ""} ${row.targetCertificateName ?? ""} ${row.providerName ?? ""}`,
      ).includes(query);
    });
  }, [rows, search, status, teamFilter, mode]);

  const columns = useMemo<ColumnDef<LearningRow, unknown>[]>(
    () => [
      ...(mode === "team"
        ? ([
            { id: "member", header: "Member", accessorFn: (row: LearningRow) => row.memberName },
            { id: "team", header: "Team", accessorFn: (row: LearningRow) => row.teamName ?? "", cell: ({ row }) => row.original.teamName ?? "—" },
          ] satisfies ColumnDef<LearningRow, unknown>[])
        : []),
      {
        id: "item",
        header: "Item",
        accessorFn: itemName,
        cell: ({ row }) => {
          const item = row.original;
          const isExam = Boolean(item.targetCertificateName);
          const provider = item.providerName ?? "Self-study";
          return (
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-medium">{itemName(item)}</span>
                <Badge variant="outline" className="rounded-sm text-caption text-muted-foreground">
                  {isExam ? "Exam" : "Course"}
                </Badge>
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
                <span className="truncate">
                  {!item.courseName ? "Self-study" : isExam ? `with ${item.courseName} · ${provider}` : `${provider} · course certificate`}
                </span>
                <CatalogueStatusBadge status={item.courseCatalogueStatus} />
              </span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <RecordStatusLabel status={row.original.status} />
            {row.original.status === "in_progress" && <span className="text-muted-foreground">· {row.original.progress}%</span>}
          </span>
        ),
      },
      {
        id: "planned",
        header: "Planned date",
        accessorFn: (row) => row.plannedDate ?? "",
        cell: ({ row }) => (row.original.status !== "done" && row.original.plannedDate ? formatDate(row.original.plannedDate) : "—"),
      },
      {
        id: "finished",
        header: "Finished",
        accessorFn: (row) => row.finishedDate ?? "",
        cell: ({ row }) => (row.original.finishedDate ? formatDate(row.original.finishedDate) : "—"),
      },
      rowActionsColumn<LearningRow>({
        rowLabel: itemName,
        onEdit: (row) => {
          setEditing(row);
          setSheetOpen(true);
        },
        onDelete: remove.request,
        extraItems: (row) =>
          row.status === "done" ? null : <DropdownMenuItem onClick={() => setSubmitting(row)}>Add certificate</DropdownMenuItem>,
      }),
    ],
    [mode, remove.request],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={mode === "team" ? "Search by member, course or exam…" : "Search by course or exam…"}
          hasActiveFilters={search.length > 0 || status !== ALL || (mode === "team" && teamFilter !== ALL)}
          onClear={() => {
            setSearch("");
            setStatus(ALL);
            setTeamFilter(ALL);
            syncSelfStatusUrl(ALL);
          }}
        >
          {mode === "team" && (
            <div className="w-44">
              <OptionSelect id="learning-team-filter" value={teamFilter} onChange={setTeamFilter} options={teamOptions} placeholder="Team" />
            </div>
          )}
          <div className="w-40">
            <OptionSelect
              id="learning-status-filter"
              value={status}
              onChange={(next) => {
                setStatus(next);
                syncSelfStatusUrl(next);
              }}
              options={STATUS_FILTER}
              placeholder="Status"
            />
          </div>
        </FilterBar>
        <AddButton
          label="Add learning"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        />
      </div>
      <DataTable
        columns={columns}
        data={visible}
        getRowId={(row) => row.id}
        empty={
          rows.length === 0 ? (
            <EmptyState title="Nothing here yet" description="Add a course you follow or an exam you are preparing for." />
          ) : (
            <EmptyState title="Nothing found" description="Try a different search or clear the filters." />
          )
        }
      />
      <LearningSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        fixedMemberId={fixedMemberId}
        memberOptions={memberOptions}
        courses={courses}
        examOptions={examOptions}
        rows={rows}
        viewerMemberId={viewerMemberId}
        canAddToCatalogue={canAddToCatalogue}
        providers={providers}
      />
      {submitting && (
        <SubmitCertificate
          key={submitting.id}
          row={submitting}
          onClose={() => setSubmitting(null)}
          certificateOptions={certificateOptions}
          completionByCourse={completionByCourse}
          providers={providers}
          showCompanyFields={showCompanyFields}
          canAddToCatalogue={canAddToCatalogue}
          canDelete={canDelete}
          viewerMemberId={viewerMemberId}
          mode={mode}
          aiReaderEnabled={aiReaderEnabled}
          records={records}
        />
      )}
      <ConfirmDialog
        open={remove.target !== null}
        onOpenChange={(open) => !open && remove.cancel()}
        title="Remove this item?"
        description={remove.target ? `${itemName(remove.target)} will be removed from the learning list.` : ""}
        confirmLabel="Remove"
        variant="destructive"
        pending={remove.pending}
        onConfirm={remove.confirm}
      />
    </div>
  );
}
