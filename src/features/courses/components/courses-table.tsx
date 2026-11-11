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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteCourse } from "@/features/courses/actions";
import { CourseSheet } from "@/features/courses/components/course-sheet";
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
  canManage,
}: {
  courses: Course[];
  /** Exam certificates a course can prepare for. */
  certificates: SelectOption[];
  providers: SelectOption[];
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
    return courses.filter((c) => `${c.name} ${c.providerName} ${c.preparesForName ?? ""} ${c.grantsCertificateName ?? ""}`.toLowerCase().includes(q));
  }, [courses, search]);

  const columns: ColumnDef<Course, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "providerName", header: "Provider" },
    {
      accessorKey: "url",
      header: "Link",
      enableSorting: false,
      cell: ({ row }) => <ExternalLinkCell url={row.original.url} label={`Open link for ${row.original.name}`} />,
    },
    { accessorKey: "preparesForName", header: "Prepares for", cell: ({ row }) => row.original.preparesForName ?? "—" },
    {
      accessorKey: "grantsCertificateName",
      header: "Grants",
      cell: ({ row }) => (row.original.grantsCertificateName ? `Completion: ${row.original.grantsCertificateName}` : "—"),
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
      accessorKey: "cost",
      header: "Cost",
      cell: ({ row }) =>
        row.original.cost != null && row.original.costCurrency ? formatMoney(row.original.cost, row.original.costCurrency) : "—",
      meta: { align: "right" },
    },
    {
      accessorKey: "estHours",
      header: "Duration (hours)",
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
        searchPlaceholder="Search courses…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      >
        {canManage && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={providers.length === 0}
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
                  }
                : null
            }
            certificates={certificates}
            providers={providers}
          />
          <ConfirmDialog
            open={!!confirming}
            onOpenChange={(open) => !open && setConfirming(null)}
            title={`Delete course ${confirming?.name}?`}
            description="A course that grants a completion cannot be deleted. Where members used it as their course studied, it is cleared. This cannot be undone."
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
