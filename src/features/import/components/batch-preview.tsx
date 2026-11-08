"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { commitImport, discardImport } from "@/features/import/actions";
import { countRows, describeNewEntities, ROW_OUTCOME_LABEL, rowOutcome, type RowOutcome } from "@/features/import/preview";
import type { ImportBatchDetail, ImportRowView } from "@/features/import/queries";
import { runBatchAction } from "@/features/import/run-batch-action";
import { formatDateTimeVn } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import type { Result } from "@/lib/result";
import { foldText } from "@/lib/text";

/** A Base UI `Select` value must be a non-empty string, so "no filter" is a sentinel, not "". */
const ALL = "all";
const OUTCOMES: RowOutcome[] = ["create", "update", "unchanged", "error"];

function isOutcome(value: string): value is RowOutcome {
  return OUTCOMES.some((outcome) => outcome === value);
}

/** Errors first (destructive, with an icon), then warnings (muted, with an icon); one per line, wrapping. */
function RowMessages({ row }: { row: ImportRowView }) {
  if (row.errors.length === 0 && row.warnings.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="flex max-w-xl min-w-64 flex-col gap-0.5 whitespace-normal">
      {row.errors.map((message, index) => (
        <li key={`e${index}`} className="flex items-start gap-1.5 text-destructive">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="sr-only">Error: </span>
          <span>{message}</span>
        </li>
      ))}
      {row.warnings.map((message, index) => (
        <li key={`w${index}`} className="flex items-start gap-1.5 text-caption text-muted-foreground">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="sr-only">Warning: </span>
          <span>{message}</span>
        </li>
      ))}
    </ul>
  );
}

function committedMessage(batch: ImportBatchDetail): string {
  const [date, time] = batch.committedAt ? formatDateTimeVn(batch.committedAt).split(" ") : [];
  const when = date && time ? `Imported ${date} at ${time}` : "Imported";
  if (!batch.summary) return `${when}.`;
  const { created, updated, skipped } = batch.summary;
  return `${when}: created ${created}, updated ${updated}, skipped ${skipped}.`;
}

export function BatchPreview({ batch, rows }: { batch: ImportBatchDetail; rows: ImportRowView[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState(ALL);
  const [confirming, setConfirming] = useState<"commit" | "discard" | null>(null);
  const [pending, setPending] = useState(false);
  // Set once an action succeeded: hides the buttons until the refreshed batch status arrives.
  const [finished, setFinished] = useState(false);

  const counts = useMemo(() => countRows(rows), [rows]);
  const newEntities = useMemo(() => describeNewEntities(rows), [rows]);
  const importable = counts.create + counts.update;
  const actionable = batch.status === "parsed" && !finished;
  // An upload that died between chunks leaves fewer rows than the parse announced; commit_import refuses it too (22023).
  const incomplete = batch.status === "parsed" && rows.length !== batch.expectedRows;

  const hasActiveFilters = search.length > 0 || outcomeFilter !== ALL;
  const visibleRows = useMemo(() => {
    const query = foldText(search);
    return rows.filter((row) => {
      if (query && !foldText(`${row.raw.email ?? ""} ${row.raw.course ?? ""} ${row.rowNo}`).includes(query)) return false;
      if (outcomeFilter !== ALL && rowOutcome(row) !== outcomeFilter) return false;
      return true;
    });
  }, [rows, search, outcomeFilter]);

  // Memoised: rebuilding columns on every render would remount cells.
  const columns = useMemo<ColumnDef<ImportRowView, unknown>[]>(
    () => [
      {
        id: "rowNo",
        header: "Row",
        accessorFn: (row) => row.rowNo,
        meta: { align: "right" },
      },
      { id: "email", header: "Email", accessorFn: (row) => row.raw.email ?? "", cell: ({ row }) => row.original.raw.email ?? "—" },
      {
        id: "course",
        header: "Course",
        accessorFn: (row) => row.raw.course ?? "",
        cell: ({ row }) => <span className="whitespace-normal">{row.original.raw.course ?? "—"}</span>,
      },
      { id: "outcome", header: "Result", accessorFn: (row) => ROW_OUTCOME_LABEL[rowOutcome(row)] },
      { id: "details", header: "Details", enableSorting: false, cell: ({ row }) => <RowMessages row={row.original} /> },
    ],
    [],
  );

  /** Shared by commit and discard: whatever happens, the server state is the truth, so always re-read it. */
  async function runAction<T>(
    action: () => Promise<Result<T>>,
    outcomes: { onOk: (data: T) => void; rejectedMessage: string },
  ) {
    if (pending) return;
    setPending(true);
    await runBatchAction(action, {
      onOk: (data) => {
        setFinished(true);
        outcomes.onOk(data);
      },
      onError: (message) => toast.error(message, { duration: Infinity }),
      onRejected: () => toast.error(outcomes.rejectedMessage, { duration: Infinity }),
      onSettled: () => {
        setPending(false);
        setConfirming(null);
        router.refresh();
      },
    });
  }

  function handleCommit() {
    return runAction(() => commitImport({ batchId: batch.id }), {
      onOk: (summary) => toast.success(`Imported: created ${summary.created}, updated ${summary.updated}`),
      rejectedMessage: "No response from the server. Reload the page to see whether this batch was imported.",
    });
  }

  function handleDiscard() {
    return runAction(() => discardImport({ batchId: batch.id }), {
      onOk: () => toast.success("Discarded batch"),
      rejectedMessage: "Could not discard the batch. Reload the page and try again.",
    });
  }

  const description = [batch.sheetName ? `Sheet ${batch.sheetName}` : null, `uploaded on ${formatDateTimeVn(batch.createdAt)}`]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Import batch: ${batch.fileName}`}
        description={description}
        actions={
          actionable && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming("discard")}
              >
                Discard batch
              </Button>
              <Button
                size="sm"
                disabled={importable === 0 || incomplete}
                onClick={() => setConfirming("commit")}
              >
                {`Import ${pluralize(importable, "row")}`}
              </Button>
            </>
          )
        }
      />

      {batch.status === "committed" && (
        <Alert>
          <CircleCheck aria-hidden />
          <AlertDescription className="text-foreground">
            {committedMessage(batch)}{" "}
            <Link href="/records" className="font-medium">
              View certificates
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {incomplete && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>
            The batch was not fully uploaded ({rows.length} of {batch.expectedRows} rows saved), so it cannot be imported. Discard the batch and upload the file again.
          </AlertDescription>
        </Alert>
      )}
      {batch.status === "discarded" && (
        <Alert>
          <Info aria-hidden />
          <AlertDescription className="text-foreground">This batch was discarded.</AlertDescription>
        </Alert>
      )}
      {batch.notes.length > 0 && (
        <Alert>
          <Info aria-hidden />
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-0.5 pl-4">
              {batch.notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <p className="text-body tabular-nums">
        {OUTCOMES.map((outcome) => `${ROW_OUTCOME_LABEL[outcome]} ${counts[outcome]}`).join(" · ")}
      </p>
      {batch.status === "parsed" && newEntities && <p className="text-body text-muted-foreground">{newEntities}</p>}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by email, course or row number…"
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setOutcomeFilter(ALL);
        }}
      >
        <Select value={outcomeFilter} onValueChange={(value) => setOutcomeFilter(value ?? ALL)}>
          <SelectTrigger aria-label="Result">
            <SelectValue>
              {(value: string) => (value === ALL ? "All" : isOutcome(value) ? ROW_OUTCOME_LABEL[value] : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {OUTCOMES.map((outcome) => (
              <SelectItem key={outcome} value={outcome}>
                {ROW_OUTCOME_LABEL[outcome]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={visibleRows}
        getRowId={(row) => row.id}
        pageSize={50}
        empty={
          rows.length === 0 ? (
            <EmptyState title="This batch has no rows" />
          ) : (
            <EmptyState title="No rows found" description="Try a different search or clear the filters." />
          )
        }
      />

      <ConfirmDialog
        open={confirming === "commit"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Import ${pluralize(importable, "row")} from ${batch.fileName}?`}
        description={`Creates ${counts.create}, updates ${counts.update}. ${pluralize(counts.error, "row")} with errors will be skipped. If any row fails, nothing is imported.`}
        confirmLabel={`Import ${pluralize(importable, "row")}`}
        pendingLabel="Importing…"
        pending={pending}
        onConfirm={handleCommit}
      />
      <ConfirmDialog
        open={confirming === "discard"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Discard this import batch?"
        description="The data in this batch will not be imported. You can still look at the batch afterwards."
        confirmLabel="Discard batch"
        pending={pending}
        onConfirm={handleDiscard}
      />
    </div>
  );
}
