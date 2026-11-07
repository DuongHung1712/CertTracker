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
import { CompletionDonut } from "@/features/dashboard/components/completion-donut";
import { ExpiryChart } from "@/features/dashboard/components/expiry-chart";
import { Explorer } from "@/features/dashboard/components/explorer";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { StatusBar } from "@/features/dashboard/components/status-bar";
import {
  expiringBuckets,
  expiryBuckets,
  kpiStudyStatusSplit,
  validBuckets,
  type ExpiryBucket,
} from "@/features/dashboard/metrics";
import type { BreakdownRow, DashboardKpis, RankingRow } from "@/features/dashboard/schema";

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
  { id: "1", code: "M001", name: "Nguyen Van An", course: "AWS Solutions Architect Associate", status: "done", progress: 100, expiryStatus: "Expiring Soon", daysToExpiry: 23, expiryDate: "2026-10-19" },
  { id: "2", code: "M002", name: "Tran Thi Binh", course: "NVIDIA Generative AI LLMs", status: "in_progress", progress: 40, expiryStatus: "N/A", daysToExpiry: null, expiryDate: null },
  { id: "3", code: "M003", name: "Le Minh Chau", course: "Azure Fundamentals AZ-900", status: "done", progress: 100, expiryStatus: "No Expiry", daysToExpiry: null, expiryDate: null },
  { id: "4", code: "M004", name: "Pham Quoc Dung", course: "CCNA", status: "done", progress: 100, expiryStatus: "Expired", daysToExpiry: -5, expiryDate: "2026-09-21" },
  { id: "5", code: "M005", name: "Vo Thi En", course: "Google Cloud Digital Leader", status: "done", progress: 100, expiryStatus: "Expiring in 60d", daysToExpiry: 48, expiryDate: "2026-11-13" },
  { id: "6", code: "M006", name: "Dang Gia Huy", course: "IBM Data Science", status: "not_started", progress: 0, expiryStatus: "Active", daysToExpiry: 400, expiryDate: "2027-10-31" },
];

// DataTable's default sort (Vietnamese collation) doesn't know what "order"
// means for these two columns — it would sort by the raw enum or the
// English `expiry_status` string. A column overrides with its own
// `sortingFn` whenever "sorted" means something other than text order.
const STATUS_RANK: Record<RecordStatus, number> = { not_started: 0, in_progress: 1, done: 2 };

const COLUMNS: ColumnDef<SampleRow, unknown>[] = [
  { accessorKey: "code", header: "Code", cell: ({ row }) => <MemberCode code={row.original.code} /> },
  { accessorKey: "name", header: "Full name" },
  { accessorKey: "course", header: "Course" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <RecordStatusLabel status={row.original.status} />,
    sortingFn: (a, b) => STATUS_RANK[a.original.status] - STATUS_RANK[b.original.status],
  },
  { accessorKey: "progress", header: "Progress", cell: ({ row }) => <ProgressInline value={row.original.progress} /> },
  {
    accessorKey: "expiryStatus",
    header: "Expiry",
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
      <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${row.original.name}`}>
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
        searchPlaceholder="Search by name, code, course…"
        hasActiveFilters={search.length > 0}
        onClear={() => setSearch("")}
      />
      <DataTable
        columns={COLUMNS}
        data={rows}
        getRowId={(row) => row.id}
        empty={<EmptyState title="No results found" description="Try another keyword or clear the filters." />}
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
        Open confirmation dialog
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete member M004 · Pham Quoc Dung?"
        description="This member's 5 certificate records will be deleted too. This cannot be undone."
        confirmLabel="Delete member"
        onConfirm={() => {
          setOpen(false);
          toast.success("Deleted member M004");
        }}
      />
    </>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success("Added member M007")}>
        Success toast
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Could not save because the connection was lost. Check your network and try again.", { duration: Infinity })}
      >
        Error toast
      </Button>
    </div>
  );
}

const COMBOBOX_OPTIONS: ComboboxOption[] = [
  { id: "m1", label: "Nguyen Van An", hint: "M001" },
  { id: "m2", label: "Tran Thi Binh", hint: "M002" },
  { id: "m3", label: "Dang Gia Huy", hint: "M006" },
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
        placeholder="Choose a member…"
        emptyText="No member found"
      />
      <p className="text-caption text-muted-foreground">
        Value (id): <code>{value === "" ? "(empty)" : value}</code>
      </p>
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setValue("ghost-id")}>
        Set an id that is not in the list
      </Button>
      <EntityCombobox
        id="demo-member-disabled"
        value="m2"
        onChange={() => {}}
        options={COMBOBOX_OPTIONS}
        placeholder="Choose a member…"
        emptyText="No member found"
        disabled
      />
    </div>
  );
}

// Dashboard blocks: the visual test for the Week 5 building blocks.
const BUCKET_STATUSES = ["Active", "Expiring in 60d", "Expiring Soon", "Expired", "No Expiry"] as const;
const BUCKET_LABELS = ["> 60 days left", "31–60 days left", "≤ 30 days left", "Expired", "No expiry"];

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

const LONG_LABEL = "Advanced cloud solutions architecture professional certificate 2026";

function row(i: number, over: Partial<BreakdownRow> = {}): BreakdownRow {
  return {
    key: `k${i}`, label: `Team ${String.fromCharCode(65 + i)}`, headcount: 4 + i, people: 3 + i, records: 10 + i,
    done: 5 + i, inProgress: 3, notStarted: 2, valid: 4 + i, expired: 0, ...over,
  };
}

const BREAKDOWN_ROWS: BreakdownRow[] = [
  ...Array.from({ length: 9 }, (_, i) => row(i)),
  row(9, { label: LONG_LABEL }),
  row(10, { label: "Empty team", headcount: 0, people: 0, records: 0, done: 0, inProgress: 0, notStarted: 0, valid: 0 }),
  row(11, { label: "Team with expired certificates", expired: 3 }),
];

const RANKING_ROWS: RankingRow[] = [
  { memberId: "00000000-0000-0000-0000-000000000001", memberCode: "M001", fullName: "Nguyen Van An", teamName: "DC34", validCerts: 4, doneCerts: 5, inProgress: 1, rank: 1 },
  { memberId: "00000000-0000-0000-0000-000000000002", memberCode: "M002", fullName: "Dang Gia Huy", teamName: null, validCerts: 3, doneCerts: 3, inProgress: 0, rank: 2 },
  { memberId: "00000000-0000-0000-0000-000000000003", memberCode: "M003", fullName: "Tran Thi Binh", teamName: "DC34", validCerts: 3, doneCerts: 3, inProgress: 2, rank: 2 },
];

export function BreakdownDemo() {
  return (
    <div className="flex flex-col gap-6">
      <BreakdownTable rows={BREAKDOWN_ROWS} groupLabel="Team" peopleLabel="Members" />
      <BreakdownTable rows={[]} groupLabel="Course" peopleLabel="Learners" />
      <RankingTable rows={RANKING_ROWS} />
    </div>
  );
}

export function DashboardRedesignDemo() {
  const sampleKpis: DashboardKpis = {
    totalMembers: 20,
    totalRecords: 61,
    doneRecords: 38,
    inProgressRecords: 14,
    notStartedRecords: 9,
    activeCerts: 42,
    expiring60Certs: 6,
    expiringSoonCerts: 3,
    expiredCerts: 2,
    noExpiryCerts: 8,
  };
  const sampleBuckets: ExpiryBucket[] = expiryBuckets(sampleKpis);
  const certSegments = kpiStudyStatusSplit(sampleKpis);
  const validSegments = validBuckets(sampleKpis);
  const expiringSegments = expiringBuckets(sampleKpis);

  const demoTabs = [
    {
      id: "team",
      label: "By team",
      groupLabel: "Team",
      peopleLabel: "Members",
      rows: BREAKDOWN_ROWS,
    },
    {
      id: "cert_type",
      label: "By certificate type",
      groupLabel: "Type",
      peopleLabel: "Learners",
      rows: BREAKDOWN_ROWS.slice(0, 4),
    },
    {
      id: "provider",
      label: "By provider",
      groupLabel: "Provider",
      peopleLabel: "Learners",
      rows: BREAKDOWN_ROWS.slice(2, 6),
    },
    {
      id: "course",
      label: "Popular courses",
      groupLabel: "Course",
      peopleLabel: "Learners",
      rows: BREAKDOWN_ROWS.slice(0, 5),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-caption font-semibold uppercase text-muted-foreground">Hero KPI cards</h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Certificate records"
            value={61}
            visual={<StatusBar segments={certSegments} />}
          />
          <KpiCard
            label="Valid"
            value={50}
            hint="Includes 8 with no expiry"
            visual={<StatusBar segments={validSegments} />}
          />
          <KpiCard
            label="Expiring (≤ 60 days)"
            value={9}
            visual={<StatusBar segments={expiringSegments} />}
          />
          <KpiCard
            label="Expired"
            value={2}
            valueClassName="text-destructive font-semibold"
            hint="Completed certificates past their expiry date"
            visual={
              <StatusBar
                segments={[{ key: "expired", label: "Expired", count: 2, color: "var(--status-expired)" }]}
              />
            }
          />
        </dl>
      </div>

      <div>
        <h3 className="mb-3 text-caption font-semibold uppercase text-muted-foreground">Health row</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
            <h4 className="mb-4 text-section-title">Expiry horizon</h4>
            <ExpiryChart buckets={sampleBuckets} />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="mb-4 text-section-title">Study status</h4>
            <CompletionDonut counts={{ done: 38, inProgress: 14, notStarted: 9 }} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-caption font-semibold uppercase text-muted-foreground">Explorer (Tabs & Detail panel)</h3>
        <Explorer tabs={demoTabs} defaultTab="team" />
      </div>
    </div>
  );
}
