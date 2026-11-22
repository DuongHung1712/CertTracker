"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { MemberCode } from "@/components/status/member-code";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { approveCertificate, rejectCertificate } from "@/features/certificates/actions";
import { approveCourse, rejectCourse } from "@/features/courses/actions";
import { countByType, describeIssue, isCatalogueIssue, isProposal, ISSUE_META, issueHref } from "@/features/data-quality/issues";
import { ISSUE_TYPES, type IssueRow, type IssueType } from "@/features/data-quality/schema";

/** Who or what the finding is about: a person for record/member issues, a certificate for catalogue issues. */
function subjectName(row: IssueRow): string | null {
  return isCatalogueIssue(row.type) ? row.certificateName : row.memberName;
}

/** Approve or reject a member proposal in place. Approving a course also adds its completion certificate, as in the Catalogue. */
function reviewProposal(row: IssueRow, decision: "approve" | "reject") {
  if (row.type === "course_proposal") {
    return decision === "approve" ? approveCourse({ id: row.subjectId, grantsCompletion: true }) : rejectCourse({ id: row.subjectId });
  }
  return decision === "approve" ? approveCertificate({ id: row.subjectId }) : rejectCertificate({ id: row.subjectId });
}

function ProposalActions({ row, onReject }: { row: IssueRow; onReject: (row: IssueRow) => void }) {
  const [busy, setBusy] = useState(false);
  const name = row.certificateName ?? "this proposal";
  async function approve() {
    setBusy(true);
    const result = await reviewProposal(row, "approve");
    setBusy(false);
    if (result.ok) toast.success(`Approved ${name}`);
    else toast.error(result.error);
  }
  return (
    <>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void approve()} aria-label={`Approve ${name}`}>
        Approve
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReject(row)} aria-label={`Reject ${name}`}>
        Reject
      </Button>
    </>
  );
}

// Warnings before suggestions, then the longest-standing first.
function byUrgency(a: IssueRow, b: IssueRow): number {
  if (a.severity !== b.severity) return a.severity === "warning" ? -1 : 1;
  return b.days - a.days;
}

export function DataQualityTable({ issues }: { issues: IssueRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<IssueType | null>(null);
  const [rejecting, setRejecting] = useState<IssueRow | null>(null);
  const [rejectPending, setRejectPending] = useState(false);

  const counts = useMemo(() => countByType(issues), [issues]);
  const sorted = useMemo(() => [...issues].sort(byUrgency), [issues]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((row) => {
      if (typeFilter && row.type !== typeFilter) return false;
      if (!q) return true;
      return [row.memberName, row.memberCode, row.certificateName, row.teamName].some((value) => value?.toLowerCase().includes(q));
    });
  }, [sorted, search, typeFilter]);

  // Memoised: a fresh `columns` array per render would remount every cell.
  const columns = useMemo<ColumnDef<IssueRow, unknown>[]>(
    () => [
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => ISSUE_META[row.type].label,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            {ISSUE_META[row.original.type].label}
            {row.original.severity === "info" && <Badge variant="secondary">Suggestion</Badge>}
          </span>
        ),
      },
      {
        id: "subject",
        header: "Subject",
        accessorFn: (row) => subjectName(row) ?? "",
        cell: ({ row }) => {
          const name = subjectName(row.original);
          if (!name) return "—";
          return (
            <span className="inline-flex items-baseline gap-2">
              {!isCatalogueIssue(row.original.type) && row.original.memberCode && (
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
        header: "Details",
        enableSorting: false,
        cell: ({ row }) => <span className="whitespace-normal">{describeIssue(row.original)}</span>,
      },
      {
        accessorKey: "days",
        header: "Days",
        meta: { align: "right" },
      },
      {
        id: "open",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const { label } = ISSUE_META[row.original.type];
          return (
            <div className="flex justify-end gap-1">
              <Link
                href={issueHref(row.original)}
                aria-label={`Open ${label} for ${subjectName(row.original) ?? "—"}`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Open
              </Link>
              {isProposal(row.original.type) && <ProposalActions row={row.original} onReject={setRejecting} />}
            </div>
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
        searchPlaceholder="Search by name, code, certificate or team…"
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
            All ({issues.length})
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
      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={`Reject ${rejecting?.certificateName ?? "this proposal"}?`}
        description="Members who already picked it keep their items, but it no longer counts. It cannot be undone here."
        confirmLabel="Reject"
        pendingLabel="Rejecting…"
        pending={rejectPending}
        onConfirm={async () => {
          if (!rejecting) return;
          setRejectPending(true);
          const result = await reviewProposal(rejecting, "reject");
          setRejectPending(false);
          if (result.ok) toast.success(`Rejected ${rejecting.certificateName ?? "the proposal"}`);
          else toast.error(result.error);
          setRejecting(null);
        }}
      />
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => `${row.type}:${row.subjectId}`}
        empty={
          issues.length === 0 ? (
            <EmptyState title="The data is clean" description="Nothing needs a review or fix right now." />
          ) : (
            <EmptyState title="No results found" description="Try a different search or clear the filters." />
          )
        }
      />
    </div>
  );
}
