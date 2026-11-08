import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getAdminNeedsAttentionItems,
  type AdminAttentionItem,
} from "@/features/dashboard/admin-metrics";
import type { RecordRow } from "@/features/records/queries";
import { cn } from "@/lib/utils";

export function AdminNeedsAttention({
  records,
  dqIssuesCount,
}: {
  records: RecordRow[];
  dqIssuesCount: number;
}) {
  const items = getAdminNeedsAttentionItems(records, dqIssuesCount);

  return (
    <section
      aria-label="Needs attention"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Needs attention
        </span>
        {items.length > 0 ? (
          <span className="inline-flex size-2 rounded-full bg-destructive" aria-hidden="true" />
        ) : (
          <Badge variant="outline" className="font-mono text-caption text-muted-foreground">
            All clear
          </Badge>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/80 bg-muted/20 p-4 text-center">
          <CheckCircle2 className="size-4 text-[var(--status-active-fg)]" aria-hidden="true" />
          <p className="text-caption font-medium text-foreground">Nothing needs attention</p>
          <p className="text-caption text-muted-foreground">
            No expired certificates, urgent expiries, or data quality findings.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <NeedsAttentionRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function NeedsAttentionRow({ item }: { item: AdminAttentionItem }) {
  if (item.type === "expired") {
    return (
      <Link
        href={item.href}
        className={cn(
          "group flex items-start justify-between gap-2 rounded-md border border-border/70 p-2.5 transition-colors",
          "hover:border-destructive/60 hover:bg-destructive/5",
          "border-l-2 border-l-destructive",
        )}
      >
        <div className="flex items-start gap-2 min-w-0">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground truncate group-hover:text-destructive transition-colors">
              {item.label}
            </span>
            <span className="text-caption text-destructive font-medium tabular-nums">
              {item.detail}
            </span>
          </div>
        </div>
        <ArrowRight
          className="size-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />
      </Link>
    );
  }

  if (item.type === "expiring_soon") {
    return (
      <Link
        href={item.href}
        className={cn(
          "group flex items-start justify-between gap-2 rounded-md border border-border/70 p-2.5 transition-colors",
          "hover:border-[var(--status-expiring-soon-fg)] hover:bg-amber-500/5",
          "border-l-2 border-l-[var(--status-expiring-soon-fg)]",
        )}
      >
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle
            className="size-4 text-[var(--status-expiring-soon-fg)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground truncate group-hover:text-[var(--status-expiring-soon-fg)] transition-colors">
              {item.label}
            </span>
            <span className="text-caption text-muted-foreground tabular-nums">
              {item.detail}
            </span>
          </div>
        </div>
        <ArrowRight
          className="size-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-start justify-between gap-2 rounded-md border border-border/70 p-2.5 transition-colors",
        "hover:border-foreground/40 hover:bg-muted/40",
        "border-l-2 border-l-muted-foreground",
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        <ShieldAlert className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {item.label}
          </span>
          <span className="text-caption text-muted-foreground tabular-nums">
            {item.detail}
          </span>
        </div>
      </div>
      <ArrowRight
        className="size-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    </Link>
  );
}
