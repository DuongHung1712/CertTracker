"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { EntityCombobox, type ComboboxOption } from "@/components/entity-combobox";
import { FilterBar } from "@/components/data/filter-bar";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { MemberCode } from "@/components/status/member-code";
import { ProgressInline } from "@/components/status/progress-inline";
import { RecordStatusLabel } from "@/components/status/record-status";
import type { RecordStatus } from "@/components/status/labels";
import { Button } from "@/components/ui/button";
import { BreakdownTable } from "@/features/dashboard/components/breakdown-table";
import { ExpiryChart } from "@/features/dashboard/components/expiry-chart";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import type { ExpiryBucket } from "@/features/dashboard/metrics";
import type { BreakdownRow, RankingRow } from "@/features/dashboard/schema";

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

const COMBOBOX_OPTIONS: ComboboxOption[] = [
  { id: "m1", label: "Nguyễn Văn An", hint: "M001" },
  { id: "m2", label: "Trần Thị Bình", hint: "M002" },
  { id: "m3", label: "Đặng Gia Huy", hint: "M006" },
];

export function ComboboxDemo() {
  const [value, setValue] = useState("m1");
  return (
    <div className="flex max-w-sm flex-col gap-3">
      <EntityCombobox
        id="demo-member"
        value={value}
        onChange={setValue}
        options={COMBOBOX_OPTIONS}
        placeholder="Chọn thành viên…"
        emptyText="Không tìm thấy thành viên"
      />
      <p className="text-caption text-muted-foreground">
        Giá trị (id): <code>{value === "" ? "(trống)" : value}</code>
      </p>
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setValue("ghost-id")}>
        Đặt id không có trong danh sách
      </Button>
      <EntityCombobox
        id="demo-member-disabled"
        value="m2"
        onChange={() => {}}
        options={COMBOBOX_OPTIONS}
        placeholder="Chọn thành viên…"
        emptyText="Không tìm thấy thành viên"
        disabled
      />
    </div>
  );
}

// Dashboard blocks: the visual test for the Week 5 building blocks.
const BUCKET_STATUSES = ["Active", "Expiring in 60d", "Expiring Soon", "Expired", "No Expiry"] as const;
const BUCKET_LABELS = ["Còn > 60 ngày", "Còn 31–60 ngày", "Còn ≤ 30 ngày", "Đã hết hạn", "Không thời hạn"];

function buckets(counts: number[]): ExpiryBucket[] {
  return BUCKET_STATUSES.map((status, i) => ({ status, label: BUCKET_LABELS[i], count: counts[i] }));
}

export function ChartDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-card p-4">
        <ExpiryChart buckets={buckets([2, 0, 1, 1, 1])} />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <ExpiryChart buckets={buckets([0, 0, 0, 0, 0])} />
      </div>
    </div>
  );
}

const LONG_LABEL = "Chứng chỉ chuyên gia kiến trúc giải pháp đám mây nâng cao 2026";

function row(i: number, over: Partial<BreakdownRow> = {}): BreakdownRow {
  return {
    key: `k${i}`, label: `Team ${String.fromCharCode(65 + i)}`, headcount: 4 + i, people: 3 + i, records: 10 + i,
    done: 5 + i, inProgress: 3, notStarted: 2, valid: 4 + i, expired: 0, ...over,
  };
}

const BREAKDOWN_ROWS: BreakdownRow[] = [
  ...Array.from({ length: 9 }, (_, i) => row(i)),
  row(9, { label: LONG_LABEL }),
  row(10, { label: "Team trống", headcount: 0, people: 0, records: 0, done: 0, inProgress: 0, notStarted: 0, valid: 0 }),
  row(11, { label: "Team có chứng chỉ hết hạn", expired: 3 }),
];

const RANKING_ROWS: RankingRow[] = [
  { memberId: "00000000-0000-0000-0000-000000000001", memberCode: "M001", fullName: "Nguyễn Văn An", teamName: "DC34", validCerts: 4, doneCerts: 5, inProgress: 1, rank: 1 },
  { memberId: "00000000-0000-0000-0000-000000000002", memberCode: "M002", fullName: "Đặng Gia Huy", teamName: null, validCerts: 3, doneCerts: 3, inProgress: 0, rank: 2 },
  { memberId: "00000000-0000-0000-0000-000000000003", memberCode: "M003", fullName: "Trần Thị Bình", teamName: "DC34", validCerts: 3, doneCerts: 3, inProgress: 2, rank: 2 },
];

export function BreakdownDemo() {
  return (
    <div className="flex flex-col gap-6">
      <BreakdownTable rows={BREAKDOWN_ROWS} groupLabel="Team" peopleLabel="Thành viên" />
      <BreakdownTable rows={[]} groupLabel="Khóa học" peopleLabel="Người học" />
      <RankingTable rows={RANKING_ROWS} />
    </div>
  );
}
