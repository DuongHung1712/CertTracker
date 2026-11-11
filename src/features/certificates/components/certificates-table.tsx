"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { ExternalLinkCell } from "@/components/data/external-link-cell";
import { FilterBar } from "@/components/data/filter-bar";
import type { SelectOption } from "@/components/option-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteCertificate } from "@/features/certificates/actions";
import { CertificateSheet } from "@/features/certificates/components/certificate-sheet";
import type { CertificateRow } from "@/features/certificates/queries";
import { pluralize } from "@/lib/plural";

const KIND_LABEL: Record<CertificateRow["kind"], string> = { exam: "Exam", completion: "Course completion" };

export function CertificatesTable({
  certificates,
  certTypes,
  providers,
  courses,
  canManage,
}: {
  certificates: CertificateRow[];
  certTypes: SelectOption[];
  providers: SelectOption[];
  /** Courses that grant nothing yet; the sheet adds back the one the edited completion already uses. */
  courses: SelectOption[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CertificateRow | null>(null);
  const [confirming, setConfirming] = useState<CertificateRow | null>(null);
  const [pending, setPending] = useState(false);

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
          {KIND_LABEL[row.original.kind]}
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
      ? ([
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-xs" aria-label={`Actions for ${row.original.name}`} />}
                >
                  <MoreHorizontal aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(row.original);
                      setSheetOpen(true);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirming(row.original)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ] satisfies ColumnDef<CertificateRow, unknown>[])
      : []),
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteCertificate({ id: confirming.id });
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else toast.success(`Deleted certificate ${confirming.name}`);
    setConfirming(null);
  }

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
          <Button
            size="sm"
            className="ml-auto"
            disabled={certTypes.length === 0 || providers.length === 0}
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Add certificate
          </Button>
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
            editing={
              editing
                ? {
                    id: editing.id,
                    kind: editing.kind,
                    name: editing.name,
                    certTypeId: editing.certTypeId ?? "",
                    providerId: editing.providerId ?? "",
                    level: editing.level ?? "",
                    validityMonths: editing.validityMonths,
                    url: editing.url,
                    courseId: editing.courseId,
                  }
                : null
            }
            certTypes={certTypes}
            providers={providers}
            courses={grantingCourses}
          />
          <ConfirmDialog
            open={!!confirming}
            onOpenChange={(open) => !open && setConfirming(null)}
            title={`Delete certificate ${confirming?.name}?`}
            description="A certificate that members hold cannot be deleted. This cannot be undone."
            confirmLabel="Delete certificate"
            pendingLabel="Deleting…"
            pending={pending}
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
