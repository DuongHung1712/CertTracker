import { Badge } from "@/components/ui/badge";
import { KpiFigure, KpiTile } from "@/features/dashboard/components/admin/kpi-tile";
import { roundedShare } from "@/features/dashboard/metrics";
import { pluralize } from "@/lib/plural";

export type ExpirySplit = { urgent: number; soon: number; later: number };

function ExpirySummary({ split }: { split: ExpirySplit }) {
  return (
    <section aria-label="Certificate expiry" className="min-w-0">
      <div
        role="img"
        aria-label={`Certificate expiry: Expires within 30 days ${split.urgent}, Expires in 31–60 days ${split.soon}, More than 60 days ${split.later}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-caption text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-status-expiring-soon-fg" aria-hidden="true" />
          {`30 days or less: ${split.urgent}`}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-status-expiring-60-fg" aria-hidden="true" />
          {`31–60 days: ${split.soon}`}
        </span>
      </div>
    </section>
  );
}

export function ExpiringCard({ split, completed }: { split: ExpirySplit; completed: number }) {
  const expiring = split.urgent + split.soon;
  const share = roundedShare(expiring, completed);

  return (
    <KpiTile
      label="Expiry"
      badge={
        <Badge variant="outline" className="font-mono text-caption text-muted-foreground">
          {`${share}% of completed`}
        </Badge>
      }
      footer={<ExpirySummary split={split} />}
    >
      <dl>
        <KpiFigure term="Expiring within 60 days" value={expiring} />
      </dl>
      <div
        role="img"
        aria-label={`Expiring within 60 days: ${pluralize(expiring, "certificate")} (${share}% of completed)`}
        className="h-1.5 overflow-hidden rounded-full bg-status-expiring-60-bg"
      >
        <div className="h-full bg-status-expiring-60-fg" style={{ width: `${share}%` }} />
      </div>
    </KpiTile>
  );
}
