import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getNeedsAttentionItems } from "@/features/dashboard/manager-metrics";
import type { RecordRow } from "@/features/records/queries";
import { cn } from "@/lib/utils";

export function NeedsAttentionFeed({ records }: { records: RecordRow[] }) {
  const items = getNeedsAttentionItems(records);
  const totalItemCount = items.length + 1; // including pending queue notice

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Needs attention
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-caption font-mono text-muted-foreground">
          {totalItemCount} items
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-center">
            <CheckCircle2 className="size-4 text-[var(--status-valid-fg)]" aria-hidden="true" />
            <p className="text-caption font-semibold text-foreground">Nothing needs attention</p>
            <p className="text-caption text-muted-foreground">
              All certificates in your teams are valid and up to date.
            </p>
          </div>
        )}

        {items.map((item) => {
          const isExp = item.urgency === "expired";
          return (
            <div
              key={item.record.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 text-caption",
                isExp
                  ? "border-[var(--status-expired-border)] bg-[var(--status-expired-bg)]/40"
                  : "border-[var(--status-expiring-soon-border)] bg-[var(--status-expiring-soon-bg)]/40",
              )}
            >
              <div className="flex items-start gap-2">
                {isExp ? (
                  <AlertCircle
                    className="size-4 text-[var(--status-expired-fg)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <Clock
                    className="size-4 text-[var(--status-expiring-soon-fg)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <div className="flex flex-col min-w-0">
                  <span
                    className={cn(
                      "font-semibold text-caption",
                      isExp ? "text-[var(--status-expired-fg)]" : "text-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="text-caption text-foreground/90 mt-0.5">
                    {item.description}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="font-mono text-caption text-muted-foreground">
                  {item.record.teamName ?? "Team Cloud"}
                </span>
                <Link
                  href={`/records?search=${encodeURIComponent(item.record.memberName)}`}
                  className={cn(
                    buttonVariants({ variant: isExp ? "destructive" : "outline", size: "sm" }),
                    "h-7 px-2.5 text-caption font-medium",
                  )}
                >
                  {isExp ? "Resolve" : "View"}
                </Link>
              </div>
            </div>
          );
        })}

        {/* Pending approvals item */}
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-card/60 p-3 text-caption">
          <div className="flex items-start gap-2">
            <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-caption text-foreground">
                  Pending manager action
                </span>
                <span className="rounded border border-border px-1 py-0.2 text-[10px] font-mono text-muted-foreground">
                  Soon
                </span>
              </div>
              <span className="text-caption text-muted-foreground mt-0.5">
                Certificate proofs awaiting manager approval.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-dashed border-border/60">
            <span className="font-mono text-caption text-muted-foreground">Review queue</span>
            <button
              type="button"
              disabled
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-7 px-2.5 text-caption border-dashed opacity-60 cursor-not-allowed",
              )}
            >
              Open queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
