import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MemberImportRow } from "@/features/members/import-plan";

const RESULT_LABEL = { create: "Create", skip: "Skipped", error: "Error" } as const;

export function ImportPreviewTable({ rows }: { rows: MemberImportRow[] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Messages</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.line}>
              <TableCell className="tabular-nums">{row.line}</TableCell>
              <TableCell>{row.fullName ?? "-"}</TableCell>
              <TableCell>{row.email ?? "-"}</TableCell>
              <TableCell>{row.teamName ?? "-"}</TableCell>
              <TableCell className={row.action === "error" ? "text-destructive" : undefined}>{RESULT_LABEL[row.action]}</TableCell>
              <TableCell className="whitespace-normal">{row.action === "skip" ? "Already a member" : row.messages.join("; ")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
