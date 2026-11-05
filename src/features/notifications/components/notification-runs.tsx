import { EmptyState } from "@/components/data/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RunRow, SetupCheck } from "@/features/notifications/runs";
import { cn } from "@/lib/utils";
import { formatDateTimeVn } from "@/lib/format";

const KIND_LABEL: Record<RunRow["kind"], string> = {
  "expiry-alert": "Expiry alert",
  "monthly-report": "Monthly report",
};

const HEAD = "h-8 bg-muted px-2.5 text-label uppercase text-muted-foreground";

/** Server Component: the history of automatic e-mails and whether the settings they need are present. */
export function NotificationRuns({ runs, checks }: { runs: RunRow[]; checks: SetupCheck[] }) {
  const missing = checks.filter((c) => !c.ok);
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Email history" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-section-title">Email history</h2>
          <p className="text-caption text-muted-foreground">Each row is one sending period; counts are per recipient.</p>
        </div>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table aria-label="Email history" className="text-table tabular-nums">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>Type</TableHead>
                <TableHead className={HEAD}>Period</TableHead>
                <TableHead className={cn(HEAD, "text-right")}>Sent</TableHead>
                <TableHead className={cn(HEAD, "text-right")}>Failed</TableHead>
                <TableHead className={cn(HEAD, "text-right")}>Sending</TableHead>
                <TableHead className={cn(HEAD, "text-right")}>Stalled (re-run)</TableHead>
                <TableHead className={HEAD}>Latest error</TableHead>
                <TableHead className={HEAD}>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="whitespace-normal">
                    <EmptyState
                      title="No e-mails sent yet"
                      description="Schedule: expiry alerts at 08:00 on Mondays, the monthly report at 08:00 on the 1st (Vietnam time)."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={`${run.kind}|${run.period}`} className="h-8 hover:bg-accent">
                    <TableCell className="px-2.5 py-1">{KIND_LABEL[run.kind]}</TableCell>
                    <TableCell className="px-2.5 py-1">{run.label}</TableCell>
                    <TableCell className="px-2.5 py-1 text-right">{run.sent}</TableCell>
                    <TableCell className={cn("px-2.5 py-1 text-right", run.failed > 0 && "font-semibold text-destructive")}>
                      {run.failed}
                    </TableCell>
                    {/* Stale claims are shown on their own: a run died and calling the route again retries them. */}
                    <TableCell className="px-2.5 py-1 text-right">{run.pending - run.stalePending}</TableCell>
                    <TableCell className={cn("px-2.5 py-1 text-right", run.stalePending > 0 && "font-semibold text-destructive")}>
                      {run.stalePending}
                    </TableCell>
                    <TableCell
                      className={cn("max-w-64 truncate px-2.5 py-1", run.lastError ? "text-destructive" : "text-muted-foreground")}
                      title={run.lastError ?? undefined}
                    >
                      {run.lastError ?? "—"}
                    </TableCell>
                    <TableCell className="px-2.5 py-1">{formatDateTimeVn(run.lastActivityAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-label="Email configuration" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-section-title">Configuration</h2>
          <p className="text-caption text-muted-foreground">Shows only whether each setting is present; values are never displayed.</p>
        </div>
        {missing.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>E-mails cannot be sent in production until every setting below is configured.</AlertTitle>
            <AlertDescription>Missing: {missing.map((c) => c.label).join(", ")}.</AlertDescription>
          </Alert>
        )}
        <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card text-body">
          {checks.map((check) => (
            <li key={check.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-table">{check.label}</span>
              <span className={check.ok ? "text-foreground" : "font-medium text-destructive"}>
                {check.ok ? "Configured" : "Not configured"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
