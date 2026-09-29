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
import { formatVnd } from "@/lib/format";

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
  estHours: number | null;
  url: string | null;
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
    { accessorKey: "name", header: "Tên khóa học" },
    { accessorKey: "certTypeName", header: "Loại" },
    { accessorKey: "providerName", header: "Nhà cung cấp" },
    { accessorKey: "level", header: "Cấp độ", cell: ({ row }) => row.original.level || "—" },
    {
      accessorKey: "validityMonths",
      header: "Thời hạn",
      cell: ({ row }) => (row.original.validityMonths ? `${row.original.validityMonths} tháng` : "Không hết hạn"),
    },
    {
      accessorKey: "refundable",
      header: "Hoàn tiền",
      cell: ({ row }) =>
        row.original.refundable ? (
          <Badge variant="secondary" className="rounded-sm">
            Có
          </Badge>
        ) : (
          <span className="text-caption text-muted-foreground">Không</span>
        ),
    },
    {
      accessorKey: "cost",
      header: "Chi phí",
      cell: ({ row }) => (row.original.cost != null ? formatVnd(row.original.cost) : "—"),
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
                  render={<Button variant="ghost" size="icon-xs" aria-label={`Thao tác cho ${row.original.name}`} />}
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
                    Sửa
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirming(row.original)}>
                    Xóa
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
    toast.success(`Đã xóa khóa học ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, loại, nhà cung cấp…"
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
            Thêm khóa học
          </Button>
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Không tìm thấy khóa học" description="Thử từ khóa khác hoặc xóa bộ lọc." />}
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
                    estHours: editing.estHours,
                    url: editing.url,
                  }
                : null
            }
            certTypes={certTypes}
            providers={providers}
          />
          <ConfirmDialog
            open={!!confirming}
            onOpenChange={(open) => !open && setConfirming(null)}
            title={`Xóa khóa học ${confirming?.name}?`}
            description="Chỉ xóa được khi chưa có ai theo học khóa này. Không thể hoàn tác."
            confirmLabel="Xóa khóa học"
            pendingLabel="Đang xóa…"
            pending={pending}
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
