"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddButton } from "@/components/data/add-button";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ExternalLinkCell } from "@/components/data/external-link-cell";
import { FilterBar } from "@/components/data/filter-bar";
import { rowActionsColumn } from "@/components/data/row-actions-column";
import { useConfirmedDelete } from "@/components/data/use-confirmed-delete";
import type { SelectOption } from "@/components/option-select";
import { Badge } from "@/components/ui/badge";
import { deleteCertificate } from "@/features/certificates/actions";
import { CERTIFICATE_KIND_LABEL, CERTIFICATE_KIND_NOUN, certificateDeleteHint } from "@/features/certificates/schema";
import { CertificateSheet } from "@/features/certificates/components/certificate-sheet";
import type { CertificateRow } from "@/features/certificates/queries";
import { pluralize } from "@/lib/plural";

const NO_CERT_TYPES_OR_PROVIDERS_HINT = "Add a certificate type and a provider first.";

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
  canManage,
}: {
  certificates: CertificateRow[];
  certTypes: SelectOption[];
  providers: SelectOption[];
  /** Courses that grant nothing yet; the table adds back the one the edited completion already uses. */
  courses: SelectOption[];
  hasCourses: boolean;
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CertificateRow | null>(null);
  const removal = useConfirmedDelete<CertificateRow>({
    remove: (certificate) => deleteCertificate({ id: certificate.id }),
    successMessage: (certificate) => `Deleted ${CERTIFICATE_KIND_NOUN[certificate.kind]} ${certificate.name}`,
  });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return certificates;
    return certificates.filter((c) => `${c.name} ${c.providerName} ${c.certTypeName} ${c.courseName ?? ""}`.toLowerCase().includes(query));
  }, [certificates, search]);

  const columns: ColumnDef<CertificateRow, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <Badge variant="secondary" className="rounded-sm">
          {CERTIFICATE_KIND_LABEL[row.original.kind]}
        </Badge>
      ),
    },
    { accessorKey: "certTypeName", header: "Type" },
    { accessorKey: "providerName", header: "Provider" },
    { accessorKey: "level", header: "Level", cell: ({ row }) => row.original.level ?? "—" },
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
    { accessorKey: "courseName", header: "Granted by", cell: ({ row }) => row.original.courseName ?? "—" },
    ...(canManage
      ? [
          rowActionsColumn<CertificateRow>({
            rowLabel: (row) => row.name,
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
        searchPlaceholder="Search certificates…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      >
        {canManage && (
          <AddButton
            label="Add certificate"
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
              title="No certificates yet"
              description={canManage ? "Add the first certificate members can hold." : "No certificates are available yet."}
            />
          ) : (
            <EmptyState title="No certificates found" description="Try a different search or clear the filters." />
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
