"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteCourse } from "@/features/courses/actions";
import { CourseSheet } from "@/features/courses/components/course-sheet";
import { formatMoney, type Currency } from "@/lib/money";

type Course = {
  id: string;
  name: string;
  // `courses.cert_type_id`/`provider_id` are nullable FKs at the DB level (on delete restrict,
  // no `not null`); the app's courseSchema always requires picking one on create/update, but
  // existing rows are typed to match the real (nullable) column.
  certTypeId: string | null;
  certTypeName: string;
  providerId: string | null;
  providerName: string;
  level: string | null;
  validityMonths: number | null;
  refundable: boolean;
  cost: number | null;
  costCurrency: Currency | null;
  estHours: number | null;
  url: string | null;
  refundConditions: string | null;
};
type Option = { id: string; name: string };

export function CoursesTable({
  courses,
  certTypes,
  providers,
  canManage,
}: {
  courses: Course[];
  certTypes: Option[];
  providers: Option[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [confirming, setConfirming] = useState<Course | null>(null);
  const [pending, setPending] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => `${c.name} ${c.certTypeName} ${c.providerName}`.toLowerCase().includes(q));
  }, [courses, search]);

  const columns: ColumnDef<Course, unknown>[] = [
    { accessorKey: "name", header: "Course name" },
    { accessorKey: "certTypeName", header: "Type" },
    { accessorKey: "providerName", header: "Provider" },
    { accessorKey: "level", header: "Level", cell: ({ row }) => row.original.level || "—" },
    {
      accessorKey: "validityMonths",
      header: "Validity",
      cell: ({ row }) =>
        row.original.validityMonths
          ? `${row.original.validityMonths} ${row.original.validityMonths === 1 ? "month" : "months"}`
          : "No expiry",
      meta: { align: "right" },
    },
    {
      accessorKey: "refundable",
      header: "Refundable",
      cell: ({ row }) =>
        row.original.refundable ? (
          <Badge variant="secondary" className="rounded-sm">
            Yes
          </Badge>
        ) : (
          <span className="text-caption text-muted-foreground">No</span>
        ),
    },
    {
      accessorKey: "cost",
      header: "Cost",
      cell: ({ row }) =>
        row.original.cost != null && row.original.costCurrency ? formatMoney(row.original.cost, row.original.costCurrency) : "—",
      meta: { align: "right" },
    },
    {
      accessorKey: "estHours",
      header: "Study hours",
      cell: ({ row }) => row.original.estHours ?? "—",
      meta: { align: "right" },
    },
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
        ] satisfies ColumnDef<Course, unknown>[])
      : []),
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteCourse({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Deleted course ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, type or provider…"
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
            Add course
          </Button>
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
                  ? "Add the first course to make it available for certificates."
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
                    certTypeId: editing.certTypeId ?? "",
                    providerId: editing.providerId ?? "",
                    level: editing.level ?? "",
                    validityMonths: editing.validityMonths,
                    refundable: editing.refundable,
                    cost: editing.cost,
                    costCurrency: editing.costCurrency,
                    estHours: editing.estHours,
                    url: editing.url,
                    refundConditions: editing.refundConditions,
                  }
                : null
            }
            certTypes={certTypes}
            providers={providers}
          />
          <ConfirmDialog
            open={!!confirming}
            onOpenChange={(open) => !open && setConfirming(null)}
            title={`Delete course ${confirming?.name}?`}
            description="A course can only be deleted when nobody has a certificate for it. This cannot be undone."
            confirmLabel="Delete course"
            pendingLabel="Deleting…"
            pending={pending}
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
