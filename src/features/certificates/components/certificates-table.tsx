"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddButton } from "@/components/data/add-button";
import { DataTable } from "@/components/data/data-table";
import { TruncatedCell } from "@/components/data/truncated-cell";
import { EmptyState } from "@/components/data/empty-state";
import { ExternalLinkCell } from "@/components/data/external-link-cell";
import { FilterBar } from "@/components/data/filter-bar";
import { rowActionsColumn } from "@/components/data/row-actions-column";
import { useConfirmedDelete } from "@/components/data/use-confirmed-delete";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { CatalogueStatusBadge } from "@/components/status/record-status";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { approveCertificate, deleteCertificate, rejectCertificate } from "@/features/certificates/actions";
import { CERTIFICATE_ADD_NEUTRAL_LABEL, CERTIFICATE_KIND_LABEL, CERTIFICATE_KIND_NOUN, CERTIFICATE_KINDS, certificateDeleteHint, formatPreparedBy } from "@/features/certificates/schema";
import { CertificateSheet } from "@/features/certificates/components/certificate-sheet";
import type { CertificateRow } from "@/features/certificates/queries";
import { pluralize } from "@/lib/plural";
import { foldText } from "@/lib/text";

const ALL = "all";
const STATUS_FILTER: SelectOption[] = [
  { id: ALL, name: "All statuses" },
  { id: "pending", name: "Waiting for approval" },
  { id: "approved", name: "Approved" },
];
const KIND_FILTER: SelectOption[] = [
  { id: ALL, name: "All kinds" },
  ...CERTIFICATE_KINDS.map((kind) => ({ id: kind, name: CERTIFICATE_KIND_LABEL[kind] })),
];

const NO_CERT_TYPES_OR_PROVIDERS_HINT = "Add a certificate type and a provider first.";

/** Exams list the courses that prepare for them; completions name the course that grants them. */
function courseCellText(row: CertificateRow, names: string[]): string | null {
  if (row.kind === "exam") return names.length > 0 ? `Prepared by: ${formatPreparedBy(names)}` : null;
  return row.courseName ? `Granted by: ${row.courseName}` : null;
}

function toCertificateInput(row: CertificateRow) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    certTypeId: row.certTypeId ?? "",
    providerId: row.providerId ?? "",
    level: row.level ?? "",
    validityMonths: row.validityMonths,
    url: row.url,
    courseId: row.courseId,
  };
}

export function CertificatesTable({
  certificates,
  certTypes,
  providers,
  courses,
  hasCourses,
  preparedBy,
  canManage,
  initialSearch = "",
}: {
  certificates: CertificateRow[];
  certTypes: SelectOption[];
  providers: SelectOption[];
  /** Courses that grant nothing yet; the table adds back the one the edited completion already uses. */
  courses: SelectOption[];
  hasCourses: boolean;
  /** Names of the courses that prepare for each exam, keyed by certificate id. */
  preparedBy: Record<string, string[]>;
  canManage: boolean;
  /** Starting value of the search box (Data Quality links here with ?search=<name>). */
  initialSearch?: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [kindFilter, setKindFilter] = useState(ALL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CertificateRow | null>(null);
  const removal = useConfirmedDelete<CertificateRow>({
    remove: (certificate) => deleteCertificate({ id: certificate.id }),
    successMessage: (certificate) => `Deleted ${CERTIFICATE_KIND_NOUN[certificate.kind]} ${certificate.name}`,
  });

  const rows = useMemo(() => {
    const query = foldText(search);
    return certificates.filter((c) => {
      if (statusFilter !== ALL && c.catalogueStatus !== statusFilter) return false;
      if (kindFilter !== ALL && c.kind !== kindFilter) return false;
      if (!query) return true;
      return foldText(`${c.name} ${c.providerName} ${c.certTypeName} ${c.courseName ?? ""} ${(preparedBy[c.id] ?? []).join(" ")}`).includes(query);
    });
  }, [certificates, preparedBy, search, statusFilter, kindFilter]);

  const columns: ColumnDef<CertificateRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <TruncatedCell text={row.original.name} />
          <CatalogueStatusBadge status={row.original.catalogueStatus} />
        </div>
      ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <Badge variant="secondary" className="rounded-sm">
          {CERTIFICATE_KIND_LABEL[row.original.kind]}
        </Badge>
      ),
    },
    { accessorKey: "certTypeName", header: "Type", cell: ({ row }) => <TruncatedCell text={row.original.certTypeName} /> },
    { accessorKey: "providerName", header: "Provider", cell: ({ row }) => <TruncatedCell text={row.original.providerName} /> },
    { accessorKey: "level", header: "Level", cell: ({ row }) => <TruncatedCell text={row.original.level ?? "—"} /> },
    {
      accessorKey: "validityMonths",
      header: "Validity",
      cell: ({ row }) => (row.original.validityMonths ? pluralize(row.original.validityMonths, "month") : "No expiry"),
    },
    {
      accessorKey: "url",
      header: "Link",
      enableSorting: false,
      cell: ({ row }) => <ExternalLinkCell url={row.original.url} label={`Open link for ${row.original.name}`} />,
    },
    {
      id: "course",
      header: "Course",
      enableSorting: false,
      cell: ({ row }) => {
        const text = courseCellText(row.original, preparedBy[row.original.id] ?? []);
        return text ? <TruncatedCell text={text} /> : <span className="text-muted-foreground">—</span>;
      },
    },
    ...(canManage
      ? [
          rowActionsColumn<CertificateRow>({
            rowLabel: (row) => row.name,
            extraItems: (row) =>
              row.catalogueStatus === "pending" ? (
                <>
                  <DropdownMenuItem
                    onClick={async () => {
                      const res = await approveCertificate({ id: row.id });
                      if (!res.ok) {
                        toast.error(res.error);
                      } else {
                        toast.success(`Approved ${row.name}`);
                      }
                    }}
                  >
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      const res = await rejectCertificate({ id: row.id });
                      if (!res.ok) {
                        toast.error(res.error);
                      } else {
                        toast.success(`Rejected ${row.name}`);
                      }
                    }}
                  >
                    Reject
                  </DropdownMenuItem>
                </>
              ) : null,
            onEdit: (row) => {
              setEditing(row);
              setSheetOpen(true);
            },
            onDelete: removal.request,
          }),
        ]
      : []),
  ];

  const removalNoun = removal.target ? CERTIFICATE_KIND_NOUN[removal.target.kind] : "";
  const canAdd = certTypes.length > 0 && providers.length > 0;
  const grantingCourses = editing?.courseId
    ? [...courses, { id: editing.courseId, name: editing.courseName ?? "" }]
    : courses;

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search exam and course certificates…"
        hasActiveFilters={search.length > 0 || statusFilter !== ALL || kindFilter !== ALL}
        onClear={() => {
          setSearch("");
          setStatusFilter(ALL);
          setKindFilter(ALL);
        }}
      >
        <div className="w-40">
          <OptionSelect id="catalogue-cert-kind-filter" value={kindFilter} onChange={setKindFilter} options={KIND_FILTER} placeholder="Kind" />
        </div>
        {canManage && (
          <div className="w-44">
            <OptionSelect id="catalogue-cert-status-filter" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER} placeholder="Status" />
          </div>
        )}
        {canManage && (
          <AddButton
            label={CERTIFICATE_ADD_NEUTRAL_LABEL}
            blockedReason={canAdd ? undefined : NO_CERT_TYPES_OR_PROVIDERS_HINT}
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          />
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={
          certificates.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              description={canManage ? "Add the first exam certificate or course certificate members can hold." : "Nothing is available yet."}
            />
          ) : (
            <EmptyState title="Nothing found" description="Try a different search or clear the filters." />
          )
        }
      />
      {canManage && (
        <>
          <CertificateSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            editing={editing ? toCertificateInput(editing) : null}
            certTypes={certTypes}
            providers={providers}
            courses={grantingCourses}
            hasCourses={hasCourses}
          />
          <ConfirmDialog
            open={!!removal.target}
            onOpenChange={(open) => !open && removal.cancel()}
            title={`Delete ${removalNoun} ${removal.target?.name}?`}
            description={removal.target ? certificateDeleteHint(removal.target.kind) : ""}
            confirmLabel={`Delete ${removalNoun}`}
            pendingLabel="Deleting…"
            pending={removal.pending}
            onConfirm={removal.confirm}
          />
        </>
      )}
    </div>
  );
}
