import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getNeedsAttentionItems } from "@/features/dashboard/manager-metrics";
import type { RecordRow } from "@/features/records/queries";
import { cn } from "@/lib/utils";

/** Expired certificates only; certificates still valid are listed in Next to expire. */
export function NeedsAttentionFeed({ records }: { records: RecordRow[] }) {
  const items = getNeedsAttentionItems(records);

  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
        Needs attention
      </span>

      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-center">
            <CheckCircle2 className="size-4 text-[var(--status-valid-fg)]" aria-hidden="true" />
            <p className="text-caption font-semibold text-foreground">Nothing needs attention</p>
            <p className="text-caption text-muted-foreground">
              No certificate in your teams has expired.
            </p>
          </div>
        )}

        {items.map(({ record, description }) => (
          <div
            key={record.id}
            className="flex flex-col gap-2 rounded-lg border border-[var(--status-expired-border)] bg-[var(--status-expired-bg)]/40 p-3 text-caption"
          >
            <div className="flex items-start gap-2">
              <AlertCircle
                className="size-4 text-[var(--status-expired-fg)] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-caption text-[var(--status-expired-fg)]">
                  Expired certificate
                </span>
                <span className="text-caption text-foreground/90 mt-0.5">{description}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="font-mono text-caption text-muted-foreground">
                {record.teamName ?? "No team"}
              </span>
              <Link
                href={`/records?search=${encodeURIComponent(record.memberName)}`}
                className={cn(
                  buttonVariants({ variant: "destructive", size: "sm" }),
                  "h-7 px-2.5 text-caption font-medium",
                )}
              >
                Resolve
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
