import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTeamReadinessLeague, type MemberReadinessRow } from "@/features/dashboard/manager-metrics";
import type { RecordRow } from "@/features/records/queries";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeamReadinessLeague({
  members,
  records,
}: {
  members: { id: string; fullName: string; teamName: string | null }[];
  records: RecordRow[];
}) {
  const rows = getTeamReadinessLeague(members, records);

  if (rows.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-center">
        <p className="text-body font-medium text-foreground">No members in your teams yet.</p>
        <p className="text-caption text-muted-foreground">
          Assigned team members will appear here once linked in your scope.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row, idx) => (
        <LeagueRow key={row.memberId} row={row} rank={idx + 1} />
      ))}
    </div>
  );
}

function LeagueRow({ row, rank }: { row: MemberReadinessRow; rank: number }) {
  const total = row.totalCount;
  const validPct = total > 0 ? (row.validCount / total) * 100 : 0;
  const inProgressPct = total > 0 ? (row.inProgressCount / total) * 100 : 0;
  const expiredPct = total > 0 ? (row.expiredCount / total) * 100 : 0;
  const notStartedPct = total > 0 ? (row.notStartedCount / total) * 100 : 0;

  return (
    <Link
      role="row"
      href={`/records?search=${encodeURIComponent(row.memberName)}`}
      aria-label={`${row.memberName}: ${row.validCount} valid certificates of ${row.totalCount} total`}
      className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-caption font-bold text-muted-foreground w-4 shrink-0 text-center">
            {rank}
          </span>
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-mono text-caption font-semibold"
          >
            {getInitials(row.memberName)}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-body font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {row.memberName}
            </span>
            {row.teamName && (
              <span className="text-caption text-muted-foreground truncate">{row.teamName}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end">
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {row.validCount} valid
            </span>
            <span className="text-caption text-muted-foreground">
              of {row.totalCount} total
            </span>
          </div>
          <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
        </div>
      </div>

      {/* Segmented bar */}
      <div
        role="img"
        aria-label={`Status breakdown for ${row.memberName}: ${row.validCount} valid, ${row.inProgressCount} in progress, ${row.expiredCount} expired, ${row.notStartedCount} not started`}
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        {total === 0 ? (
          <div className="h-full w-full bg-muted-foreground/20" />
        ) : (
          <>
            {validPct > 0 && (
              <div
                style={{ width: `${validPct}%` }}
                className="h-full bg-[var(--status-active-fg)] transition-all"
                title={`${row.validCount} valid`}
              />
            )}
            {inProgressPct > 0 && (
              <div
                style={{ width: `${inProgressPct}%` }}
                className="h-full bg-[var(--status-expiring-soon-fg)] transition-all"
                title={`${row.inProgressCount} in progress`}
              />
            )}
            {expiredPct > 0 && (
              <div
                style={{ width: `${expiredPct}%` }}
                className="h-full bg-destructive transition-all"
                title={`${row.expiredCount} expired`}
              />
            )}
            {notStartedPct > 0 && (
              <div
                style={{ width: `${notStartedPct}%` }}
                className="h-full bg-muted-foreground/30 transition-all"
                title={`${row.notStartedCount} not started`}
              />
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-muted-foreground font-mono">
        <span className="text-[var(--status-active-fg)] font-medium">{row.validCount} valid</span>
        <span>·</span>
        <span>{row.inProgressCount} in progress</span>
        {row.expiredCount > 0 && (
          <>
            <span>·</span>
            <span className="text-destructive font-semibold">{row.expiredCount} expired</span>
          </>
        )}
        <span>·</span>
        <span>{row.notStartedCount} not started</span>
      </div>
    </Link>
  );
}
