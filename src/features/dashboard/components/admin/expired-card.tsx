import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KpiFigure, KpiTile } from "@/features/dashboard/components/admin/kpi-tile";

export function ExpiredCard({ expired }: { expired: number }) {
  const hasExpired = expired > 0;
  return (
    <KpiTile
      label="Expired"
      badge={hasExpired ? <Badge variant="destructive" className="font-mono text-caption">Action needed</Badge> : null}
      footer={
        hasExpired ? (
          <p className="text-caption text-status-expired-fg">Past expiry date. Members need to renew these.</p>
        ) : (
          <div
            role="img"
            aria-label="No expired certificates."
            className="flex items-center gap-2 text-caption text-muted-foreground"
          >
            <CheckCircle2 className="size-4 shrink-0 text-status-active-fg" aria-hidden="true" />
            <span className="truncate">No expired certificates</span>
          </div>
        )
      }
    >
      <dl>
        <KpiFigure term="Expired" value={expired} tone={hasExpired ? "text-status-expired-fg" : undefined} hideTerm />
      </dl>
    </KpiTile>
  );
}
