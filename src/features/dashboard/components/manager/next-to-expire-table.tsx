import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { buttonVariants } from "@/components/ui/button";
import { getNextToExpire } from "@/features/dashboard/manager-metrics";
import type { RecordRow } from "@/features/records/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/initials";

export function NextToExpireTable({ records }: { records: RecordRow[] }) {
  const rows = getNextToExpire(records, 8);

  if (rows.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-center">
        <CheckCircle2 className="size-5 text-[var(--status-valid-fg)]" aria-hidden="true" />
        <p className="text-body font-medium text-foreground">No upcoming expirations</p>
        <p className="text-caption text-muted-foreground">
          All completed certificates have more than 60 days of validity remaining.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="relative overflow-x-auto rounded border border-border">
        <table className="w-full text-table text-left">
          <thead className="border-b border-border bg-muted/40 text-label uppercase tracking-wider text-muted-foreground font-mono">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Person</th>
              <th scope="col" className="px-3 py-2 font-medium">Certificate</th>
              <th scope="col" className="px-3 py-2 font-medium">Expiry date</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-accent/40 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary font-mono text-caption font-semibold"
                    >
                      {getInitials(row.memberName)}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground truncate">{row.memberName}</span>
                      <span className="font-mono text-caption text-muted-foreground">
                        {row.teamName ?? "No team"}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate max-w-xs">{row.certificateName}</span>
                    {row.providerName && (
                      <span className="text-caption text-muted-foreground">{row.providerName}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-caption text-foreground whitespace-nowrap">
                  {row.expiryDate ? formatDate(row.expiryDate) : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <ExpiryBadge
                    status={row.expiryStatus}
                    daysToExpiry={row.daysToExpiry}
                    expiryDate={row.expiryDate}
                  />
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <Link
                    href={`/records?search=${encodeURIComponent(row.memberName)}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-caption")}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
