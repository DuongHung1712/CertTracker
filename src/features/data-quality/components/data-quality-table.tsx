"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { MemberCode } from "@/components/status/member-code";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { countByType, describeIssue, ISSUE_META } from "@/features/data-quality/issues";
import { ISSUE_TYPES, type IssueRow, type IssueType } from "@/features/data-quality/schema";

/** Who or what the finding is about: a person for record/member issues, a course for catalogue issues. */
function subjectName(row: IssueRow): string | null {
  return row.type === "course_no_validity" ? row.courseName : row.memberName;
}

// Warnings before suggestions, then the longest-standing first.
function byUrgency(a: IssueRow, b: IssueRow): number {
  if (a.severity !== b.severity) return a.severity === "warning" ? -1 : 1;
  return b.days - a.days;
}

export function DataQualityTable({ issues }: { issues: IssueRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<IssueType | null>(null);

  const counts = useMemo(() => countByType(issues), [issues]);
  const sorted = useMemo(() => [...issues].sort(byUrgency), [issues]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((row) => {
      if (typeFilter && row.type !== typeFilter) return false;
      if (!q) return true;
      return [row.memberName, row.memberCode, row.courseName, row.teamName].some((value) => value?.toLowerCase().includes(q));
    });
  }, [sorted, search, typeFilter]);

  // Memoised: a fresh `columns` array per render would remount every cell.
  const columns = useMemo<ColumnDef<IssueRow, unknown>[]>(
    () => [
      {
        id: "type",
        header: "Loại",
        accessorFn: (row) => ISSUE_META[row.type].label,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            {ISSUE_META[row.original.type].label}
            {row.original.severity === "info" && <Badge variant="secondary">Gợi ý</Badge>}
          </span>
        ),
      },
      {
        id: "subject",
        header: "Đối tượng",
        accessorFn: (row) => subjectName(row) ?? "",
        cell: ({ row }) => {
          const name = subjectName(row.original);
          if (!name) return "—";
          return (
            <span className="inline-flex items-baseline gap-2">
              {row.original.type !== "course_no_validity" && row.original.memberCode && (
                <MemberCode code={row.original.memberCode} />
              )}
              {name}
            </span>
          );
        },
      },
      { id: "team", header: "Team", accessorFn: (row) => row.teamName ?? "", cell: ({ row }) => row.original.teamName ?? "—" },
      {
        id: "detail",
        header: "Chi tiết",
        enableSorting: false,
        cell: ({ row }) => <span className="whitespace-normal">{describeIssue(row.original)}</span>,
      },
      { accessorKey: "days", header: "Số ngày" },
      {
        id: "open",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const { label, href } = ISSUE_META[row.original.type];
          return (
            <Link
              href={href}
              aria-label={`Mở ${label} của ${subjectName(row.original) ?? "—"}`}
              className={buttonVariants({ variant: "ghost", size: "xs" })}
            >
              Mở
            </Link>
          );
        },
      },
    ],
    [],
  );

  const hasActiveFilters = search.length > 0 || typeFilter !== null;
  const visibleTypes = ISSUE_TYPES.filter((type) => counts[type] > 0);

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên, mã, khóa học, team…"
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setTypeFilter(null);
        }}
      />
      {visibleTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={typeFilter === null ? "secondary" : "outline"}
            aria-pressed={typeFilter === null}
            onClick={() => setTypeFilter(null)}
          >
            Tất cả ({issues.length})
          </Button>
          {visibleTypes.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={typeFilter === type ? "secondary" : "outline"}
              aria-pressed={typeFilter === type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            >
              {ISSUE_META[type].label} ({counts[type]})
            </Button>
          ))}
        </div>
      )}
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => `${row.type}:${row.subjectId}`}
        empty={
          issues.length === 0 ? (
            <EmptyState title="Dữ liệu đang sạch" description="Không có bản ghi nào cần rà soát." />
          ) : (
            <EmptyState title="Không có kết quả" description="Thử đổi bộ lọc." />
          )
        }
      />
    </div>
  );
}
