import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  countAdminAttentionRecords,
  getAdminNeedsAttentionItems,
  type AdminAttentionItem,
} from "@/features/dashboard/admin-metrics";
import type { RecordRow } from "@/features/records/queries";
import { cn } from "@/lib/utils";

const TONES = {
  expired: {
    icon: AlertCircle,
    row: "border-l-status-expired-fg hover:border-status-expired-fg hover:bg-status-expired-bg",
    iconColor: "text-status-expired-fg",
    detail: "font-medium text-status-expired-fg",
  },
  expiring_soon: {
    icon: AlertTriangle,
    row: "border-l-status-expiring-soon-fg hover:border-status-expiring-soon-fg hover:bg-status-expiring-soon-bg",
    iconColor: "text-status-expiring-soon-fg",
    detail: "text-muted-foreground",
  },
  data_quality: {
    icon: ShieldAlert,
    row: "border-l-muted-foreground hover:border-foreground/40 hover:bg-muted/40",
    iconColor: "text-muted-foreground",
    detail: "text-muted-foreground",
  },
} as const;

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function AttentionRow({ item }: { item: AdminAttentionItem }) {
  const tone = TONES[item.type];
  const Icon = tone.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-start justify-between gap-2 rounded-md border border-l-2 border-border p-2.5 transition-colors",
        tone.row,
        FOCUS_RING,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", tone.iconColor)} aria-hidden="true" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-semibold text-foreground">{item.label}</span>
          <span className={cn("text-caption tabular-nums", tone.detail)}>{item.detail}</span>
        </div>
      </div>
      <ArrowRight
        className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      />
    </Link>
  );
}

function AllClear() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/20 p-4 text-center">
      <CheckCircle2 className="size-4 text-status-active-fg" aria-hidden="true" />
      <p className="text-caption font-medium text-foreground">Nothing needs attention</p>
      <p className="text-caption text-muted-foreground">
        No expired certificates, none expire within 30 days, and no data problems.
      </p>
    </div>
  );
}

/** `dqIssuesCount` is undefined when the data quality query failed: that is said, never shown as zero. */
export function AdminNeedsAttention({
  records,
  dqIssuesCount,
}: {
  records: RecordRow[];
  dqIssuesCount: number | undefined;
}) {
  const items = getAdminNeedsAttentionItems(records, dqIssuesCount ?? 0);
  const total = countAdminAttentionRecords(records);
  const shown = items.filter((item) => item.type !== "data_quality").length;
  const isEmpty = items.length === 0 && dqIssuesCount !== undefined;

  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-label tracking-wider text-muted-foreground">Needs attention</span>
        {!isEmpty && <span className="inline-flex size-2 rounded-full bg-destructive" aria-hidden="true" />}
      </div>

      {isEmpty ? (
        <AllClear />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <AttentionRow key={item.id} item={item} />
          ))}
          {dqIssuesCount === undefined && (
            <p className="rounded-md border border-dashed border-destructive p-2.5 text-caption text-destructive">
              Data quality could not be loaded. Reload the page to try again.
            </p>
          )}
          {total > shown && (
            <p className="text-caption text-muted-foreground">
              {`Showing ${shown} of ${total}. `}
              <Link href="/records" className={cn("rounded-sm font-medium text-foreground underline", FOCUS_RING)}>
                View all certificates
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
