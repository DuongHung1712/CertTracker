"use client";

import Link from "next/link";
import { useState } from "react";
import { Award, BookOpen, Clock, FileText, Pencil, Plus, ShieldAlert, Trash2, type LucideIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/data/empty-state";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import { expiryMeta, toExpiryStatus, type ExpiryTone } from "@/components/status/expiry";
import { ExpiryBadge } from "@/components/status/expiry-badge";
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
import { isApprovedDone, isRecordDeletableByMember, kindCounts, learningPath } from "@/features/records/kind";
import { CERTIFICATE_KIND_NOUN } from "@/features/certificates/schema";
import { RecordSheet } from "@/features/records/components/record-sheet";
import { deleteRecord } from "@/features/records/actions";
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
  onEditRecord: (record: RecordRow | null) => void;
}) {
  const [tab, setTab] = useState<MemberTab>("all");
  const [sort, setSort] = useState<MemberSort>("expiry");

  const tabCounts = getMemberTabCounts(records);
  const filteredRecords = filterMemberRecords(records, tab, sort);
  const visibleRecords = filteredRecords.slice(0, 8);
  const hasMore = filteredRecords.length > 8;

  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<RecordRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
            </TabsList>
          </Tabs>
        )}
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="Nothing added yet"
          description="Passed an exam or finished a course? Add the certificate with its proof."
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
            // Verified = counted (approved, not renewed) and still valid; a Waiting or Returned item is not.
            const isVerified =
              isApprovedDone(record) && (record.expiryStatus === "Active" || record.expiryStatus === "No Expiry");
            // A held credential (approved, not renewed) reads as a certificate in the Credential Vault style.
            const isHeld = isApprovedDone(record);
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
                      data-sealed={isHeld ? "true" : undefined}
                      className={cn("size-9 shrink-0 rounded-md border flex items-center justify-center", tileClassName)}
                    >
                      <TileIcon className="size-4" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <h4 className="text-sm font-semibold text-foreground leading-snug truncate">
                        {record.certificateName}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
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
                        counted={isApprovedDone(record)}
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

                {/* Credential Vault only (hidden in Classic): the record line of a held credential. */}
                {isHeld && (
                  <dl className="vault-credential-strip">
                    <div>
                      <dt>Issued</dt>
                      <dd>{record.issuedDate ? formatDate(record.issuedDate) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Valid to</dt>
                      <dd>{record.expiryDate ? formatDate(record.expiryDate) : "No expiry"}</dd>
                    </div>
                    <div>
                      <dt>Holder</dt>
                      <dd>{record.memberCode}</dd>
                    </div>
                  </dl>
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
