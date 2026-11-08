"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/data/empty-state";
import type { ComboboxOption } from "@/components/entity-combobox";
import type { ExpiryStatus } from "@/components/status/expiry";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { ProgressInline } from "@/components/status/progress-inline";
import { RecordStatusLabel } from "@/components/status/record-status";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  filterMemberRecords,
  getMemberTabCounts,
  type MemberSort,
  type MemberTab,
} from "@/features/dashboard/member-metrics";
import { RecordSheet } from "@/features/records/components/record-sheet";
import type { RecordRow } from "@/features/records/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MemberCertificatesList({
  records,
  courseOptions,
  memberId,
  sheetOpen,
  onSheetOpenChange,
  editingRecord,
  onEditRecord,
}: {
  records: RecordRow[];
  courseOptions: ComboboxOption[];
  memberId: string;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  editingRecord: RecordRow | null;
  onEditRecord: (record: RecordRow | null) => void;
}) {
  const [tab, setTab] = useState<MemberTab>("all");
  const [sort, setSort] = useState<MemberSort>("expiry");

  const tabCounts = getMemberTabCounts(records);
  const filteredRecords = filterMemberRecords(records, tab, sort);
  const visibleRecords = filteredRecords.slice(0, 8);
  const hasMore = filteredRecords.length > 8;

  function handleAdd() {
    onEditRecord(null);
    onSheetOpenChange(true);
  }

  function handleEdit(record: RecordRow) {
    onEditRecord(record);
    onSheetOpenChange(true);
  }

  return (
    <section
      aria-label="My certificates"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-section-title font-semibold text-foreground">My certificates</h2>
          <span className="text-caption text-muted-foreground">({records.length})</span>
        </div>

        {records.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-caption text-muted-foreground">Sort:</span>
            <Select value={sort} onValueChange={(val) => setSort(val as MemberSort)}>
              <SelectTrigger className="h-7 w-28 text-caption">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expiry">Expiry</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {records.length > 0 ? (
        <Tabs value={tab} onValueChange={(val) => setTab(val as MemberTab)} className="w-full">
          <TabsList className="flex flex-wrap gap-1 bg-muted/60 p-1 rounded-md">
            <TabsTrigger value="all" className="text-caption">
              All ({tabCounts.all})
            </TabsTrigger>
            <TabsTrigger value="valid" className="text-caption">
              Valid ({tabCounts.valid})
            </TabsTrigger>
            <TabsTrigger value="expiring" className="text-caption">
              Expiring ({tabCounts.expiring})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="text-caption">
              In progress ({tabCounts.in_progress})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          description="Add your first certificate to start tracking your progress."
          action={
            <Button onClick={handleAdd}>
              <Plus className="size-4" aria-hidden="true" />
              Add your first certificate
            </Button>
          }
        />
      ) : visibleRecords.length === 0 ? (
        <EmptyState
          title="No certificates in this filter"
          description="Select another filter tab to view your certificates."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-table">
            <thead className="border-b border-border bg-muted/20 text-label uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Course & Provider</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Date</th>
                <th scope="col" className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRecords.map((record) => (
                <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                  {/* Course & Provider */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{record.courseName}</span>
                      <span className="text-caption text-muted-foreground">
                        {record.providerName ?? "Provider not set"}
                        {record.certTypeName ? ` · ${record.certTypeName}` : ""}
                      </span>
                    </div>
                  </td>

                  {/* Status / ExpiryBadge */}
                  <td className="px-3 py-2.5">
                    {record.status === "done" && record.expiryStatus ? (
                      <ExpiryBadge
                        status={record.expiryStatus as ExpiryStatus}
                        daysToExpiry={record.daysToExpiry}
                        expiryDate={record.expiryDate}
                      />
                    ) : record.status === "in_progress" ? (
                      <div className="flex items-center gap-2 max-w-[140px]">
                        <ProgressInline value={record.progress} />
                      </div>
                    ) : (
                      <RecordStatusLabel status={record.status} />
                    )}
                  </td>

                  {/* Expiry / Target Date */}
                  <td className="px-3 py-2.5 whitespace-nowrap text-caption text-muted-foreground">
                    {record.status === "done" ? (
                      record.expiryDate ? (
                        formatDate(record.expiryDate)
                      ) : (
                        "No expiry"
                      )
                    ) : record.status === "in_progress" && record.plannedExamDate ? (
                      `Target: ${formatDate(record.plannedExamDate)}`
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {record.hasEvidence && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                render={
                                  <a
                                    href={`/api/records/${record.id}/evidence`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  />
                                }
                                aria-label={`View evidence for ${record.courseName}`}
                              >
                                <FileText className="size-3.5" aria-hidden="true" />
                              </Button>
                            }
                          />
                          <TooltipContent side="top">View evidence</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleEdit(record)}
                              aria-label={`Edit ${record.courseName}`}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Button>
                          }
                        />
                        <TooltipContent side="top">Edit certificate</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center border-t border-border pt-3">
          <Link
            href="/me"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            View all certificates ({filteredRecords.length})
          </Link>
        </div>
      )}

      <RecordSheet
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        editing={editingRecord}
        memberOptions={[]}
        courseOptions={courseOptions}
        showCompanyFields={false}
        fixedMemberId={memberId}
      />
    </section>
  );
}
