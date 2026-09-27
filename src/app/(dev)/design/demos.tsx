"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { MemberCode } from "@/components/status/member-code";
import { ProgressInline } from "@/components/status/progress-inline";
import { RecordStatusLabel } from "@/components/status/record-status";
import type { RecordStatus } from "@/components/status/labels";
import { Button } from "@/components/ui/button";

type SampleRow = {
  id: string;
  code: string;
  name: string;
  course: string;
  status: RecordStatus;
  progress: number;
  expiryStatus: string;
  daysToExpiry: number | null;
  expiryDate: string | null;
};

// Example rows for the showcase only.
const SAMPLE_ROWS: SampleRow[] = [
  { id: "1", code: "M001", name: "Nguyễn Văn An", course: "AWS Solutions Architect Associate", status: "done", progress: 100, expiryStatus: "Expiring Soon", daysToExpiry: 23, expiryDate: "2026-10-19" },
  { id: "2", code: "M002", name: "Trần Thị Bình", course: "NVIDIA Generative AI LLMs", status: "in_progress", progress: 40, expiryStatus: "N/A", daysToExpiry: null, expiryDate: null },
  { id: "3", code: "M003", name: "Lê Minh Châu", course: "Azure Fundamentals AZ-900", status: "done", progress: 100, expiryStatus: "No Expiry", daysToExpiry: null, expiryDate: null },
  { id: "4", code: "M004", name: "Phạm Quốc Dũng", course: "CCNA", status: "done", progress: 100, expiryStatus: "Expired", daysToExpiry: -5, expiryDate: "2026-09-21" },
  { id: "5", code: "M005", name: "Võ Thị Én", course: "Google Cloud Digital Leader", status: "done", progress: 100, expiryStatus: "Expiring in 60d", daysToExpiry: 48, expiryDate: "2026-11-13" },
  { id: "6", code: "M006", name: "Đặng Gia Huy", course: "IBM Data Science", status: "not_started", progress: 0, expiryStatus: "Active", daysToExpiry: 400, expiryDate: "2027-10-31" },
];

// DataTable's default sort (Vietnamese collation) doesn't know what "order"
// means for these two columns — it would sort by the raw enum or the
// English `expiry_status` string. A column overrides with its own
// `sortingFn` whenever "sorted" means something other than text order.
const STATUS_RANK: Record<RecordStatus, number> = { not_started: 0, in_progress: 1, done: 2 };

const COLUMNS: ColumnDef<SampleRow, unknown>[] = [
  { accessorKey: "code", header: "Mã", cell: ({ row }) => <MemberCode code={row.original.code} /> },
  { accessorKey: "name", header: "Họ tên" },
  { accessorKey: "course", header: "Khóa học" },
  {
    accessorKey: "status",
    header: "Trạng thái",
    cell: ({ row }) => <RecordStatusLabel status={row.original.status} />,
    sortingFn: (a, b) => STATUS_RANK[a.original.status] - STATUS_RANK[b.original.status],
  },
  { accessorKey: "progress", header: "Tiến độ", cell: ({ row }) => <ProgressInline value={row.original.progress} /> },
  {
    accessorKey: "expiryStatus",
    header: "Hạn",
    cell: ({ row }) => (
      <ExpiryBadge
        status={row.original.expiryStatus}
        daysToExpiry={row.original.daysToExpiry}
        expiryDate={row.original.expiryDate}
      />
    ),
    // Urgency order (days left, ascending), not the English status string;
    // no expiry date (null) always sorts to the "far" end.
    sortingFn: (a, b) =>
      (a.original.daysToExpiry ?? Number.POSITIVE_INFINITY) - (b.original.daysToExpiry ?? Number.POSITIVE_INFINITY),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-xs" aria-label={`Thao tác cho ${row.original.name}`}>
        <MoreHorizontal aria-hidden />
      </Button>
    ),
  },
];

export function TableDemo() {
  const [search, setSearch] = useState("");
  const rows = useMemo(
    () => SAMPLE_ROWS.filter((row) => `${row.code} ${row.name} ${row.course}`.toLowerCase().includes(search.toLowerCase())),
    [search],
  );
  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã, khóa học…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      />
      <DataTable
        columns={COLUMNS}
        data={rows}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Không tìm thấy kết quả" description="Thử từ khóa khác hoặc xóa bộ lọc." />}
      />
    </div>
  );
}

export function LoadingTableDemo() {
  return <DataTable columns={COLUMNS} data={[]} isLoading />;
}

export function ConfirmDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Mở hộp thoại xác nhận
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xóa thành viên M004 · Phạm Quốc Dũng?"
        description="5 bản ghi chứng chỉ của người này cũng sẽ bị xóa. Không thể hoàn tác."
        confirmLabel="Xóa thành viên"
        onConfirm={() => {
          setOpen(false);
          toast.success("Đã xóa thành viên M004");
        }}
      />
    </>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success("Đã thêm thành viên M007")}>
        Toast thành công
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Không lưu được do mất kết nối. Kiểm tra mạng rồi thử lại.", { duration: Infinity })}
      >
        Toast lỗi
      </Button>
    </div>
  );
}
