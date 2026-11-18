"use client";

import Link from "next/link";
import { useState } from "react";
import { Award, BookOpen, CircleCheck, Clock, FileText, Pencil, Plus, ShieldAlert, Trash2, type LucideIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/data/empty-state";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import { expiryMeta, toExpiryStatus, type ExpiryTone } from "@/components/status/expiry";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { clampPercent, type RecordStatus } from "@/components/status/labels";
import { ApprovalBadge, CatalogueStatusBadge, RecordStatusLabel } from "@/components/status/record-status";
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
import { isApprovedDone, isRecordDeletableByMember, kindCounts, learningPath, plannedDateLabel } from "@/features/records/kind";
import { CERTIFICATE_KIND_NOUN } from "@/features/certificates/schema";
import { RecordSheet } from "@/features/records/components/record-sheet";
import { deleteRecord, updateRecordProgress } from "@/features/records/actions";
import type { RecordRow } from "@/features/records/queries";
import { formatDate } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

/** "2 exam certificates, 1 course completion": the two kinds are counted apart, never as one "certificates". */
function learningSummary(records: RecordRow[]): string {
  const { exam, completion } = kindCounts(records);
  return `${pluralize(exam, "exam certificate")}, ${pluralize(completion, "course completion")}`;
}

function tileTone(record: RecordRow): TileTone {
  if (record.status === "done") return expiryMeta(toExpiryStatus(record.expiryStatus)).tone;
  return record.status === "in_progress" ? "in-progress" : "neutral";
}

export function MemberCertificatesList({
  fullName,
  records,
  certificateOptions,
  studyCourses,
  memberId,
  sheetOpen,
  onSheetOpenChange,
  editingRecord,
  presetStatus,
  presetCertificateId,
  onEditRecord,
}: {
  fullName: string;
  records: RecordRow[];
  certificateOptions: CertificateChoice[];
  studyCourses: StudyCourse[];
  memberId: string;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  editingRecord: RecordRow | null;
  /** Status the sheet opens with ("Mark completed"); owned by the parent with `editingRecord`. */
  presetStatus?: RecordStatus;
  /** Certificate to pre-select (e.g. renewal flow). */
  presetCertificateId?: string;
  onEditRecord: (record: RecordRow | null, presetStatus?: RecordStatus) => void;
}) {
  const [tab, setTab] = useState<MemberTab>("all");
  const [sort, setSort] = useState<MemberSort>("expiry");

  const tabCounts = getMemberTabCounts(records);
  const filteredRecords = filterMemberRecords(records, tab, sort);
  const visibleRecords = filteredRecords.slice(0, 8);
  const hasMore = filteredRecords.length > 8;

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [progressOverrides, setProgressOverrides] = useState<Record<string, number>>({});
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<RecordRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleQuickStep(recordId: string, currentProgress: number, step: number, certName: string) {
    const nextProgress = Math.min(99, Math.max(0, currentProgress + step));
    if (nextProgress === currentProgress) return;

    setUpdatingId(recordId);
    setProgressOverrides((prev) => ({ ...prev, [recordId]: nextProgress }));

    const res = await updateRecordProgress(recordId, nextProgress);
    setUpdatingId(null);
    if (!res.ok) {
      toast.error(res.error);
      setProgressOverrides((prev) => {
        const copy = { ...prev };
        delete copy[recordId];
        return copy;
      });
    } else {
      toast.success(`Updated ${certName} progress to ${nextProgress}%`);
    }
  }

  function handleAdd() {
    onEditRecord(null);
    onSheetOpenChange(true);
  }

  function handleEdit(record: RecordRow, preset?: RecordStatus) {
    onEditRecord(record, preset);
    onSheetOpenChange(true);
  }

  return (
    <section
      aria-label="My learning"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      {/* Header and Filter strip */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-foreground">My learning</h3>
            <p className="text-xs text-muted-foreground">
              {`${learningSummary(records)} for ${fullName}`}
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
            <TabsList className="h-auto flex-wrap gap-1 overflow-visible bg-muted/60 p-1 rounded-md group-data-horizontal/tabs:h-auto">
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
          title="Nothing added yet"
          description="Planning an exam or a course? Add it now and update its status as you go."
          action={
            <Button onClick={handleAdd} size="sm">
              <Plus className="size-4" aria-hidden="true" />
              Add your first certificate or course completion
            </Button>
          }
        />
      ) : visibleRecords.length === 0 ? (
        <EmptyState
          title="Nothing in this filter"
          description="Select another filter tab to see the rest."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleRecords.map((record) => {
            const isInProgress = record.status === "in_progress";
            // Verified = counted (approved, not renewed) and still valid; a Waiting or Returned item is not.
            const isVerified =
              isApprovedDone(record) && (record.expiryStatus === "Active" || record.expiryStatus === "No Expiry");
            const tone = tileTone(record);
            const { icon: TileIcon, className: tileClassName } = TILE[tone];

            return (
              <div
                key={record.id}
                data-slot="card"
                data-verified={isVerified ? "true" : undefined}
                className="vault-card flex flex-col gap-2.5 rounded-lg border border-border/80 bg-background/50 p-3.5 transition-colors hover:border-border"
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
                        {record.certificateName}
                      </h4>
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {record.providerName ?? "Provider not set"}
                        {record.certTypeName ? ` · ${record.certTypeName}` : ""}
                      </p>
                      {record.certificateKind === "exam" && (
                        <p className="text-caption text-muted-foreground truncate">{learningPath(record)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {record.status === "done" && record.expiryStatus ? (
                      <ExpiryBadge
                        status={record.expiryStatus}
                        daysToExpiry={record.daysToExpiry}
                        expiryDate={record.expiryDate}
                        kind={record.certificateKind}
                      />
                    ) : (
                      <RecordStatusLabel status={record.status} />
                    )}
                    {record.status === "done" && <ApprovalBadge approval={record.approval} />}
                    <CatalogueStatusBadge status={record.certificateCatalogueStatus} />

                    <div className="flex items-center gap-1">
                      {record.hasEvidence && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                render={
                                  <a
                                    href={`/api/records/${record.id}/evidence`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  />
                                }
                                aria-label={`View evidence for ${record.certificateName}`}
                              >
                                <FileText className="size-4" aria-hidden="true" />
                              </Button>
                            }
                          />
                          <TooltipContent side="top">View evidence</TooltipContent>
                        </Tooltip>
                      )}

                      {record.status !== "done" && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(record, "done")}
                                aria-label={`Mark ${record.certificateName} completed`}
                              >
                                <CircleCheck className="size-4" aria-hidden="true" />
                              </Button>
                            }
                          />
                          <TooltipContent side="top">Mark completed</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(record)}
                              aria-label={`Edit ${record.certificateName}`}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                          }
                        />
                        <TooltipContent side="top">Edit</TooltipContent>
                      </Tooltip>

                      {isRecordDeletableByMember(record) && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfirmDeleteRecord(record)}
                                aria-label={`Delete ${record.certificateName}`}
                              >
                                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" aria-hidden="true" />
                              </Button>
                            }
                          />
                          <TooltipContent side="top">Delete draft</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>

                {/* In Progress Study Progress Meter Row */}
                {isInProgress && (
                  <div className="flex flex-col gap-2 border-t border-border/50 pt-2 sm:flex-row sm:items-center sm:justify-between sm:pl-12">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between text-caption">
                        <span className="text-muted-foreground">Study progress</span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={updatingId === record.id || (progressOverrides[record.id] ?? record.progress) >= 99}
                              onClick={() => handleQuickStep(record.id, progressOverrides[record.id] ?? record.progress, 10, record.certificateName)}
                              className="h-5 px-1.5 text-[10px] font-mono leading-none rounded hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                              aria-label={`Add 10% progress to ${record.certificateName}`}
                            >
                              +10%
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={updatingId === record.id || (progressOverrides[record.id] ?? record.progress) >= 99}
                              onClick={() => handleQuickStep(record.id, progressOverrides[record.id] ?? record.progress, 25, record.certificateName)}
                              className="h-5 px-1.5 text-[10px] font-mono leading-none rounded hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                              aria-label={`Add 25% progress to ${record.certificateName}`}
                            >
                              +25%
                            </Button>
                          </div>
                          <span className="font-mono font-medium text-foreground">
                            {progressOverrides[record.id] ?? record.progress}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${clampPercent(progressOverrides[record.id] ?? record.progress)}%` }}
                        />
                      </div>
                    </div>

                    {record.plannedExamDate && (
                      <div className="flex flex-col items-start sm:items-end text-caption text-muted-foreground shrink-0 sm:pl-4">
                        <span className="text-caption">{plannedDateLabel(record.certificateKind)}</span>
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
            View all ({filteredRecords.length})
          </Link>
        </div>
      )}

      <RecordSheet
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        editing={editingRecord}
        presetStatus={presetStatus}
        presetCertificateId={presetCertificateId}
        memberOptions={[]}
        certificateOptions={certificateOptions}
        studyCourses={studyCourses}
        showCompanyFields={false}
        fixedMemberId={memberId}
        canDelete={false}
        records={records}
        onEditExisting={handleEdit}
      />

      <ConfirmDialog
        open={!!confirmDeleteRecord}
        onOpenChange={(open) => !open && setConfirmDeleteRecord(null)}
        title={confirmDeleteRecord ? `Delete ${confirmDeleteRecord.certificateName}?` : ""}
        description={`The ${confirmDeleteRecord ? CERTIFICATE_KIND_NOUN[confirmDeleteRecord.certificateKind] : "certificate"} and its evidence file will be deleted. This cannot be undone.`}
        confirmLabel={`Delete ${confirmDeleteRecord ? CERTIFICATE_KIND_NOUN[confirmDeleteRecord.certificateKind] : "certificate"}`}
        pendingLabel="Deleting…"
        pending={deleting}
        onConfirm={async () => {
          if (!confirmDeleteRecord) return;
          setDeleting(true);
          const result = await deleteRecord({ id: confirmDeleteRecord.id });
          setDeleting(false);
          if (!result.ok) {
            toast.error(result.error);
          } else {
            toast.success(`Deleted ${confirmDeleteRecord.certificateName}`);
            setConfirmDeleteRecord(null);
          }
        }}
      />
    </section>
  );
}
