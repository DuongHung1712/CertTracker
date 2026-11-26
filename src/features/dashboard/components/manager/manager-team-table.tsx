import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MemberReadinessRow } from "@/features/dashboard/manager-metrics";
import { formatNumber } from "@/lib/format";

function Status({ row }: { row: MemberReadinessRow }) {
  if (row.expiredCount > 0) return <Badge variant="destructive" className="rounded-sm">Needs renewal</Badge>;
  if (row.validCount > 0) return <Badge variant="secondary" className="rounded-sm">Ready</Badge>;
  return <Badge variant="outline" className="rounded-sm">No certificate yet</Badge>;
}

/** The people the manager looks after: how many valid certificates, what they are studying, and whether anything needs renewing. */
export function ManagerTeamTable({ rows, showTeam }: { rows: MemberReadinessRow[]; showTeam: boolean }) {
  if (rows.length === 0) {
    return <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-body text-muted-foreground">No members in this team yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            {showTeam && <TableHead>Team</TableHead>}
            <TableHead className="text-right">Valid</TableHead>
            <TableHead className="text-right">In progress</TableHead>
            <TableHead className="text-right">Expired</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.memberId}>
              <TableCell>
                <Link href={`/records?search=${encodeURIComponent(row.memberName)}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                  {row.memberName}
                </Link>
              </TableCell>
              {showTeam && <TableCell className="text-muted-foreground">{row.teamName ?? "No team"}</TableCell>}
              <TableCell className="text-right tabular-nums">{formatNumber(row.validCount)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(row.inProgressCount)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(row.expiredCount)}</TableCell>
              <TableCell>
                <Status row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
