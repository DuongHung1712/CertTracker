import Link from "next/link";
import { AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, UserX, type LucideIcon } from "lucide-react";
import { getManagerAttention, type ManagerAttentionKind } from "@/features/dashboard/manager-metrics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { RecordRow } from "@/features/records/queries";
import { cn } from "@/lib/utils";

const KIND: Record<ManagerAttentionKind, { icon: LucideIcon; colour: string }> = {
  expired: { icon: AlertCircle, colour: "text-status-expired-fg" },
  expiring: { icon: AlertTriangle, colour: "text-status-expiring-soon-fg" },
  exam: { icon: CalendarClock, colour: "text-muted-foreground" },
  no_certificate: { icon: UserX, colour: "text-muted-foreground" },
};

/**
 * Everything a manager should look at, in one list: expired and soon-to-expire certificates, exams coming up, and members with
 * no certificate yet. Each row opens that person's rows in Learning.
 */
export function ManagerAttentionList({
  records,
  members,
  showTeam,
  incomplete = false,
}: {
  records: RecordRow[];
  members: { id: string; fullName: string; teamName: string | null }[];
  /** Name the team on each row when the manager looks after more than one. */
  showTeam: boolean;
  /** Learning items could not be loaded: exams coming up may be missing, so an empty list is not an all clear. */
  incomplete?: boolean;
}) {
  const { items, total } = getManagerAttention(records, members);

  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-section-title font-semibold text-foreground">Needs attention</h2>
        <p className="text-caption text-muted-foreground">
          {total === 0 && !incomplete ? "Nothing to chase right now." : "Expired or expiring certificates, exams coming up and people with no certificate yet."}
        </p>
      </div>

      {incomplete && (
        <Alert variant="destructive">
          <AlertTitle>Learning items could not be loaded</AlertTitle>
          <AlertDescription>Exams coming up may be missing from this list. Reload the page to try again.</AlertDescription>
        </Alert>
      )}

      {items.length === 0 ? (
        incomplete ? null : <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-body text-muted-foreground">
          <CheckCircle2 aria-hidden className="size-4 shrink-0 text-status-active-fg" />
          No certificate in your teams has expired or is about to, and everyone has one.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const { icon: Icon, colour } = KIND[item.kind];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-1 py-2.5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Icon aria-hidden className={cn("size-4 shrink-0", colour)} />
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground" title={item.title}>
                    {item.title}
                  </span>
                  {showTeam && item.teamName && <span className="hidden shrink-0 text-caption text-muted-foreground sm:inline">{item.teamName}</span>}
                  <span className={cn("shrink-0 text-caption tabular-nums", item.kind === "expired" ? "font-medium text-status-expired-fg" : "text-muted-foreground")}>
                    {item.detail}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > items.length && (
        <p className="text-caption text-muted-foreground">
          {`Showing ${items.length} of ${total}. `}
          <Link href="/records" className="font-medium text-foreground underline underline-offset-2">
            Open Learning
          </Link>
        </p>
      )}
    </section>
  );
}
