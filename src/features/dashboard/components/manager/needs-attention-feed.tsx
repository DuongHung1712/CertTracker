import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getNeedsAttentionItems } from "@/features/dashboard/manager-metrics";
import type { RecordRow } from "@/features/records/queries";

export function NeedsAttentionFeed({ records }: { records: RecordRow[] }) {
  const items = getNeedsAttentionItems(records);

  if (items.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-center">
        <CheckCircle2 className="size-5 text-[var(--status-active-fg)]" aria-hidden="true" />
        <p className="text-body font-medium text-foreground">Nothing needs attention</p>
        <p className="text-caption text-muted-foreground">
          All certificates in your teams are valid and up to date.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const isExp = item.urgency === "expired";
        return (
          <div
            key={item.record.id}
            className={`flex items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors ${
              isExp
                ? "border-destructive/30 bg-destructive/5"
                : "border-[var(--status-expiring-soon-border)] bg-card"
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {isExp ? (
                <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Clock className="size-4 text-[var(--status-expiring-soon-fg)] shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-body font-semibold truncate ${
                    isExp ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {item.title}
                </span>
                <span className="text-caption text-muted-foreground mt-0.5">{item.description}</span>
              </div>
            </div>

            <Link
              href={`/records?search=${encodeURIComponent(item.record.memberName)}`}
              className={buttonVariants({
                variant: isExp ? "destructive" : "outline",
                size: "sm",
              })}
            >
              {isExp ? "Resolve" : "View"}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
