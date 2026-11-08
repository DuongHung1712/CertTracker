"use client";

import Link from "next/link";
import { useState } from "react";
import { Award, BookOpen, Clock, FileText, Pencil, Plus, ShieldAlert, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/data/empty-state";
import type { ComboboxOption } from "@/components/entity-combobox";
import { expiryMeta, toExpiryStatus, type ExpiryTone } from "@/components/status/expiry";
import { ExpiryBadge } from "@/components/status/expiry-badge";
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
import { clampPercent } from "@/features/dashboard/metrics";
import { RecordSheet } from "@/features/records/components/record-sheet";
import type { RecordRow } from "@/features/records/queries";
import { formatDate } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";

type TileTone = ExpiryTone | "in-progress" | "neutral";

// Literal class strings so Tailwind generates them; the status utilities are the ones ExpiryBadge uses.
const TILE: Record<TileTone, { icon: LucideIcon; className: string }> = {
  active: { icon: Award, className: "border-status-active-border bg-status-active-bg text-status-active-fg" },
  "expiring-60": { icon: Clock, className: "border-status-expiring-60-border bg-status-expiring-60-bg text-status-expiring-60-fg" },
  "expiring-soon": { icon: Clock, className: "border-status-expiring-soon-border bg-status-expiring-soon-bg text-status-expiring-soon-fg" },
  expired: { icon: ShieldAlert, className: "border-status-expired-border bg-status-expired-bg text-status-expired-fg" },
  "no-expiry": { icon: Award, className: "border-status-no-expiry-border bg-status-no-expiry-bg text-status-no-expiry-fg" },
  na: { icon: BookOpen, className: "border-status-na-border bg-status-na-bg text-status-na-fg" },
  "in-progress": { icon: BookOpen, className: "border-primary/20 bg-primary/10 text-primary" },
  neutral: { icon: BookOpen, className: "border-border bg-muted text-muted-foreground" },
};

function tileTone(record: RecordRow): TileTone {
  if (record.status === "done") return expiryMeta(toExpiryStatus(record.expiryStatus)).tone;
  return record.status === "in_progress" ? "in-progress" : "neutral";
}

export function MemberCertificatesList({
  fullName,
  records,
  courseOptions,
  memberId,
  sheetOpen,
  onSheetOpenChange,
  editingRecord,
  onEditRecord,
}: {
  fullName: string;
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
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      {/* Header and Filter strip */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-foreground">My certificates</h3>
            <p className="text-xs text-muted-foreground">
              {`${pluralize(records.length, "certificate")} for ${fullName}`}
            </p>
          </div>

          {records.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-center">
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

        {records.length > 0 && (
          <Tabs value={tab} onValueChange={(val) => setTab(val as MemberTab)} className="w-full">
            <TabsList className="flex flex-wrap gap-1 bg-muted/60 p-1 rounded-md">
              <TabsTrigger value="all" className="text-caption">
                {`All (${tabCounts.all})`}
              </TabsTrigger>
              <TabsTrigger value="valid" className="text-caption">
                {`Valid (${tabCounts.valid})`}
              </TabsTrigger>
              <TabsTrigger value="expiring" className="text-caption">
                {`Expiring within 60 days (${tabCounts.expiring})`}
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="text-caption">
                {`In progress (${tabCounts.in_progress})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          description="Add your first certificate to start tracking your progress."
          action={
            <Button onClick={handleAdd} size="sm">
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
        <div className="flex flex-col gap-3">
          {visibleRecords.map((record) => {
            const isInProgress = record.status === "in_progress";
            const tone = tileTone(record);
            const { icon: TileIcon, className: tileClassName } = TILE[tone];

            return (
              <div
                key={record.id}
                className="flex flex-col gap-2.5 rounded-lg border border-border/80 bg-background/50 p-3.5 transition-colors hover:border-border"
              >
                {/* Main Row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      aria-hidden="true"
                      data-tone={tone}
                      className={cn("size-9 shrink-0 rounded-md border flex items-center justify-center", tileClassName)}
                    >
                      <TileIcon className="size-4" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <h4 className="text-sm font-semibold text-foreground leading-snug truncate">
                        {record.courseName}
                      </h4>
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {record.providerName ?? "Provider not set"}
                        {record.certTypeName ? ` · ${record.certTypeName}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {record.status === "done" && record.expiryStatus ? (
                      <ExpiryBadge
                        status={record.expiryStatus}
                        daysToExpiry={record.daysToExpiry}
                        expiryDate={record.expiryDate}
                      />
                    ) : record.status === "in_progress" ? (
                      <RecordStatusLabel status={record.status} />
                    ) : (
                      <RecordStatusLabel status={record.status} />
                    )}

                    <div className="flex items-center gap-1">
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
                  </div>
                </div>

                {/* In Progress Study Progress Meter Row */}
                {isInProgress && (
                  <div className="flex flex-col gap-2 border-t border-border/50 pt-2 sm:flex-row sm:items-center sm:justify-between sm:pl-12">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between text-caption">
                        <span className="text-muted-foreground">Study progress</span>
                        <span className="font-mono font-medium text-foreground">
                          {record.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${clampPercent(record.progress)}%` }}
                        />
                      </div>
                    </div>

                    {record.plannedExamDate && (
                      <div className="flex flex-col items-start sm:items-end text-caption text-muted-foreground shrink-0 sm:pl-4">
                        <span className="text-[10px]">Planned exam date</span>
                        <span className="font-mono text-xs font-medium text-foreground">
                          {formatDate(record.plannedExamDate)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
