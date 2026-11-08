import { AlertCircle, Clock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttentionRecord } from "@/features/dashboard/member-metrics";
import type { RecordRow } from "@/features/records/queries";
import { formatDate } from "@/lib/format";
import { daysLeftLabel } from "@/lib/plural";

export function MemberAttentionBanner({
  attention,
  onUploadProof,
}: {
  attention: AttentionRecord | null;
  onUploadProof: (record: RecordRow) => void;
}) {
  if (!attention) return null;

  const { record, urgency } = attention;
  const isExpired = urgency === "expired";

  return (
    <aside
      aria-label="Certificate attention required"
      className={
        isExpired
          ? "flex flex-col gap-3 rounded-lg border border-[var(--status-expired-border)] bg-[var(--status-expired-bg)] p-3.5 text-[var(--status-expired-fg)] sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 rounded-lg border border-[var(--status-expiring-soon-border)] bg-[var(--status-expiring-soon-bg)] p-3.5 text-[var(--status-expiring-soon-fg)] sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        {isExpired ? (
          <AlertCircle className="size-5 shrink-0 text-[var(--status-expired-fg)]" aria-hidden="true" />
        ) : (
          <Clock className="size-5 shrink-0 text-[var(--status-expiring-soon-fg)]" aria-hidden="true" />
        )}
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2 text-body">
          <span className="font-semibold">
            {isExpired ? "Certificate expired:" : "Expires soon:"}
          </span>
          <span className="font-medium text-foreground">{record.courseName}</span>
          <span className="text-caption opacity-80 sm:text-body">
            {isExpired
              ? `Expired on ${formatDate(record.expiryDate!)}`
              : record.daysToExpiry === 0
                ? `${daysLeftLabel(0)} (${formatDate(record.expiryDate!)})`
                : `Expires on ${formatDate(record.expiryDate!)} (${daysLeftLabel(record.daysToExpiry!)})`}
          </span>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        className={
          isExpired
            ? "border-[var(--status-expired-border)] bg-background text-foreground hover:bg-background/90 shrink-0 self-start sm:self-center"
            : "border-[var(--status-expiring-soon-border)] bg-background text-foreground hover:bg-background/90 shrink-0 self-start sm:self-center"
        }
        onClick={() => onUploadProof(record)}
      >
        <Upload className="size-4" aria-hidden="true" />
        Upload evidence
      </Button>
    </aside>
  );
}
