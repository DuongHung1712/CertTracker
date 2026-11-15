"use client";

import Link from "next/link";
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
import type { SelectOption } from "@/components/option-select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteCourse } from "@/features/courses/actions";
import { CourseSheet } from "@/features/courses/components/course-sheet";
import { courseDeleteDescription } from "@/features/courses/schema";
import { formatMoney, type Currency } from "@/lib/money";

type Course = {
  id: string;
  name: string;
  // `courses.provider_id` is a nullable FK at the DB level (no `not null`); the form always requires one.
  providerId: string | null;
  providerName: string;
  preparesForId: string | null;
  preparesForName: string | null;
  grantsCertificateName: string | null;
  refundable: boolean;
  cost: number | null;
  costCurrency: Currency | null;
  estHours: number | null;
  url: string | null;
  refundConditions: string | null;
};

export function CoursesTable({
  courses,
  certificates,
  providers,
  certTypes,
  canManage,
}: {
  courses: Course[];
  /** Exam certificates a course can prepare for. */
  certificates: SelectOption[];
  providers: SelectOption[];
  certTypes: SelectOption[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const removal = useConfirmedDelete<Course>({
    remove: (course) => deleteCourse({ id: course.id }),
    successMessage: (course) => `Deleted course ${course.name}`,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => `${c.name} ${c.providerName} ${c.preparesForName ?? ""} ${c.grantsCertificateName ?? ""}`.toLowerCase().includes(q));
  }, [courses, search]);

  const columns: ColumnDef<Course, unknown>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <TruncatedCell text={row.original.name} /> },
    { accessorKey: "providerName", header: "Provider", cell: ({ row }) => <TruncatedCell text={row.original.providerName} /> },
    {
      accessorKey: "estHours",
      header: "Duration (hours)",
      cell: ({ row }) => row.original.estHours ?? "—",
      meta: { align: "right" },
    },
    {
      accessorKey: "cost",
      header: "Cost",
      cell: ({ row }) =>
        row.original.cost != null && row.original.costCurrency ? formatMoney(row.original.cost, row.original.costCurrency) : "—",
      meta: { align: "right" },
    },
    {
      accessorKey: "refundable",
      header: "Refundable",
      cell: ({ row }) =>
        row.original.refundable ? (
          <div className="flex max-w-56 flex-col items-start gap-0.5">
            <Badge variant="secondary" className="rounded-sm">
              Yes
            </Badge>
            {row.original.refundConditions && (
              <Tooltip>
                <TooltipTrigger render={<span className="max-w-full truncate text-caption text-muted-foreground" />}>
                  {row.original.refundConditions}
                </TooltipTrigger>
                <TooltipContent>{row.original.refundConditions}</TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          <span className="text-caption text-muted-foreground">No</span>
        ),
    },
    {
      accessorKey: "url",
      header: "Link",
      enableSorting: false,
      cell: ({ row }) => <ExternalLinkCell url={row.original.url} label={`Open link for ${row.original.name}`} />,
    },
    { accessorKey: "preparesForName", header: "Prepares for", cell: ({ row }) => <TruncatedCell text={row.original.preparesForName ?? "—"} /> },
    {
      accessorKey: "grantsCertificateName",
      header: "Grants",
      cell: ({ row }) => <TruncatedCell text={row.original.grantsCertificateName ?? "—"} />,
    },
    ...(canManage
      ? [
          rowActionsColumn<Course>({
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

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search courses…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      >
        {canManage && (
          <AddButton
            label="Add course"
            blockedReason={providers.length === 0 ? "Add a provider first." : undefined}
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
          courses.length === 0 ? (
            <EmptyState
              title="No courses yet"
              description={
                canManage
                  ? "Add the first course to make it available as a way to study."
                  : "No courses are available yet."
              }
            />
          ) : (
            <EmptyState title="No courses found" description="Try a different search or clear the filters." />
          )
        }
      />
      {canManage && (
        <>
          <CourseSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            editing={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    providerId: editing.providerId ?? "",
                    preparesForId: editing.preparesForId,
                    refundable: editing.refundable,
                    cost: editing.cost,
                    costCurrency: editing.costCurrency,
                    estHours: editing.estHours,
                    url: editing.url,
                    refundConditions: editing.refundConditions,
                    grantsCertificateName: editing.grantsCertificateName,
                  }
                : null
            }
            certificates={certificates}
            providers={providers}
            certTypes={certTypes}
          />
          <ConfirmDialog
            open={!!removal.target}
            onOpenChange={(open) => !open && removal.cancel()}
            title={`Delete course ${removal.target?.name}?`}
            description={courseDeleteDescription(removal.target?.grantsCertificateName ?? null)}
            confirmLabel="Delete course"
            confirmDisabled={!!removal.target?.grantsCertificateName}
            pendingLabel="Deleting…"
            pending={removal.pending}
            onConfirm={removal.confirm}
          >
            {removal.target?.grantsCertificateName && (
              <Link href="/courses" onClick={removal.cancel} className="text-body text-primary underline underline-offset-2">
                Open the Certificates tab
              </Link>
            )}
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}
