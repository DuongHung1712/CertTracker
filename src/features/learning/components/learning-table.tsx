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
import { RECORD_STATUS_LABEL } from "@/components/status/labels";
import { CatalogueStatusBadge, RecordStatusLabel } from "@/components/status/record-status";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { deleteLearningItem } from "@/features/learning/actions";
import { LearningSheet } from "@/features/learning/components/learning-sheet";
import { SubmitCertificate } from "@/features/learning/components/submit-certificate";
import type { CourseOption, LearningRow } from "@/features/learning/queries";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import { RECORD_STATUSES } from "@/features/records/schema";
import { formatDate } from "@/lib/format";
import { foldText } from "@/lib/text";

const ALL = "all";
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
  studyCourses = [],
  providers,
  initialSearch = "",
}: {
  rows: LearningRow[];
  mode: "self" | "team";
  fixedMemberId?: string;
  memberOptions?: ComboboxOption[];
  courses: CourseOption[];
  examOptions: ComboboxOption[];
  /** The signed-in member, who proposes a missing course; null for an admin. */
  viewerMemberId?: string | null;
  /** For "Submit certificate": the certificate sheet needs the catalogue. */
  certificateOptions?: CertificateChoice[];
  studyCourses?: StudyCourse[];
  providers?: { id: string; name: string }[];
  /** Links open the list already searched (?search=<name>). */
  initialSearch?: string;
}) {
  const [submitting, setSubmitting] = useState<LearningRow | null>(null);
  // A course's completion certificate (catalogue: certificates.course_id), for "Submit certificate".
  const completionByCourse = useMemo(
    () => new Map(certificateOptions.flatMap((c) => (c.kind === "completion" && c.grantingCourse ? [[c.grantingCourse.id, c.id] as const] : []))),
    [certificateOptions],
  );
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(ALL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LearningRow | null>(null);
  const remove = useConfirmedDelete<LearningRow>({
    remove: (row) => deleteLearningItem({ id: row.id }),
    successMessage: (row) => `Removed ${itemName(row)}`,
  });

  const visible = useMemo(() => {
    const query = foldText(search.trim());
    return rows.filter(
      (row) =>
        (status === ALL || row.status === status) &&
        (!query || foldText(`${row.courseName ?? ""} ${row.targetCertificateName ?? ""} ${row.providerName ?? ""} ${row.memberName}`).includes(query)),
    );
  }, [rows, search, status]);

  const columns = useMemo<ColumnDef<LearningRow, unknown>[]>(
    () => [
      ...(mode === "team"
        ? [{ id: "member", header: "Member", accessorFn: (row: LearningRow) => row.memberName } satisfies ColumnDef<LearningRow, unknown>]
        : []),
      {
        id: "item",
        header: "Item",
        accessorFn: itemName,
        cell: ({ row }) => {
          const item = row.original;
          const isExam = Boolean(item.targetCertificateName);
          const provider = item.providerName ?? "No provider";
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
                  {!item.courseName ? "Self-study" : isExam ? `with ${item.courseName} · ${provider}` : `${provider} · completion certificate`}
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
        extraItems: (row) => <DropdownMenuItem onClick={() => setSubmitting(row)}>Submit certificate</DropdownMenuItem>,
      }),
    ],
    [mode, remove.request],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search by course or exam…" hasActiveFilters={status !== ALL} onClear={() => setStatus(ALL)}>
          <div className="w-40">
            <OptionSelect id="learning-status-filter" value={status} onChange={setStatus} options={STATUS_FILTER} placeholder="Status" />
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
      />
      {submitting && (
        <SubmitCertificate
          key={submitting.id}
          row={submitting}
          onClose={() => setSubmitting(null)}
          certificateOptions={certificateOptions}
          studyCourses={studyCourses}
          completionByCourse={completionByCourse}
          providers={providers}
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
