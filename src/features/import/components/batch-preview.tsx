"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { commitImport, discardImport } from "@/features/import/actions";
import { OUTCOME_ALL, OutcomePills, type OutcomeFilter } from "@/features/import/components/outcome-pills";
import { NewEntitiesList } from "@/features/import/components/new-entities";
import {
  commitDescription, countRows, hasNewEntities, listNewEntities, rawCell, ROW_OUTCOME_LABEL, rowOutcome,
  type ExistingNames, type NewEntities, type RowOutcome,
} from "@/features/import/preview";
import type { ImportBatchDetail, ImportRowView } from "@/features/import/queries";
import { runBatchAction } from "@/features/import/run-batch-action";
import { formatDateTimeVn } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import type { Result } from "@/lib/result";
import { foldText } from "@/lib/text";

const ALL = OUTCOME_ALL;

/** Errors first (destructive, with an icon), then warnings (muted, with an icon); one per line, wrapping. */
function RowMessages({ row }: { row: ImportRowView }) {
  if (row.errors.length === 0 && row.warnings.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="flex max-w-xl min-w-0 flex-col gap-0.5 whitespace-normal wrap-anywhere md:min-w-64">
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

const OUTCOME_CLASS: Record<RowOutcome, string> = {
  create: "font-medium",
  update: "font-medium",
  unchanged: "text-muted-foreground",
  error: "font-medium text-destructive",
};

function OutcomeLabel({ row }: { row: ImportRowView }) {
  const outcome = rowOutcome(row);
  return <span className={OUTCOME_CLASS[outcome]}>{ROW_OUTCOME_LABEL[outcome]}</span>;
}

const CARDS_PER_STEP = 25;

/** Narrow screens: one card per row, so Result and Details sit right under the row's own data instead of off to the side. */
function RowCards({ rows }: { rows: ImportRowView[] }) {
  const [shown, setShown] = useState(CARDS_PER_STEP);
  return (
    <div className="flex flex-col gap-2 md:hidden" data-testid="row-cards">
      <ul className="flex flex-col gap-2">
        {rows.slice(0, shown).map((row) => {
          const studied = rawCell(row, "courseStudied");
          return (
            <li key={row.id} className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-3 text-body">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-caption text-muted-foreground tabular-nums">{`Row ${row.rowNo}`}</span>
                <OutcomeLabel row={row} />
              </div>
              <span className="font-medium wrap-anywhere">{row.raw.course ?? "—"}</span>
              <span className="text-muted-foreground wrap-anywhere">{row.raw.email ?? "—"}</span>
              {studied && <span className="text-caption text-muted-foreground wrap-anywhere">{`Course studied: ${studied}`}</span>}
              <RowMessages row={row} />
            </li>
          );
        })}
      </ul>
      {shown < rows.length && (
        <Button variant="outline" size="sm" className="self-center" onClick={() => setShown((count) => count + CARDS_PER_STEP)}>
          {`Show more (${rows.length - shown} left)`}
        </Button>
      )}
      {rows.length === 0 && <EmptyState title="No rows found" description="Try a different search or clear the filters." />}
    </div>
  );
}

function newEntitiesSummary(entities: NewEntities): string | null {
  if (!hasNewEntities(entities)) return null;
  const parts: string[] = [];
  if (entities.members.length > 0) parts.push(pluralize(entities.members.length, "member"));
  if (entities.providers.length > 0) parts.push(pluralize(entities.providers.length, "provider"));
  if (entities.certTypes.length > 0) parts.push(pluralize(entities.certTypes.length, "certificate type"));
  if (entities.certificates.length > 0) parts.push(pluralize(entities.certificates.length, "certificate"));
  if (entities.courses.length > 0) parts.push(pluralize(entities.courses.length, "course"));
  return `Will also create ${parts.join(", ")}.`;
}

function committedMessage(batch: ImportBatchDetail): string {
  const [date, time] = batch.committedAt ? formatDateTimeVn(batch.committedAt).split(" ") : [];
  const when = date && time ? `Imported ${date} at ${time}` : "Imported";
  if (!batch.summary) return `${when}.`;
  const { created, updated, skipped } = batch.summary;
  return `${when}: created ${created}, updated ${updated}, skipped ${skipped}.`;
}

export function BatchPreview({ batch, rows, existingNames }: { batch: ImportBatchDetail; rows: ImportRowView[]; existingNames?: ExistingNames }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>(ALL);
  const [confirming, setConfirming] = useState<"commit" | "discard" | null>(null);
  const [pending, setPending] = useState(false);
  // Set once an action succeeded: hides the buttons until the refreshed batch status arrives.
  const [finished, setFinished] = useState(false);

  const counts = useMemo(() => countRows(rows), [rows]);
  const newEntities = useMemo(() => listNewEntities(rows, existingNames), [rows, existingNames]);
  const importable = counts.create + counts.update;
  const actionable = batch.status === "parsed" && !finished;
  // An upload that died between chunks leaves fewer rows than the parse announced; commit_import refuses it too (22023).
  const incomplete = batch.status === "parsed" && rows.length !== batch.expectedRows;

  const hasActiveFilters = search.length > 0 || outcomeFilter !== ALL;
  const visibleRows = useMemo(() => {
    const query = foldText(search);
    return rows.filter((row) => {
      if (query && !foldText(`${row.raw.email ?? ""} ${row.raw.course ?? ""} ${rawCell(row, "courseStudied") ?? ""} ${row.rowNo}`).includes(query)) return false;
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
      {
        id: "email",
        header: "Email",
        accessorFn: (row) => row.raw.email ?? "",
        cell: ({ row }) => <span className="wrap-anywhere">{row.original.raw.email ?? "—"}</span>,
      },
      {
        id: "certificate",
        header: "Certificate",
        accessorFn: (row) => row.raw.course ?? "",
        cell: ({ row }) => <span className="whitespace-normal wrap-anywhere">{row.original.raw.course ?? "—"}</span>,
      },
      {
        id: "courseStudied",
        header: "Course studied",
        accessorFn: (row) => rawCell(row, "courseStudied") ?? "",
        cell: ({ row }) => <span className="whitespace-normal wrap-anywhere">{rawCell(row.original, "courseStudied") ?? "—"}</span>,
      },
      {
        id: "outcome",
        header: "Result",
        accessorFn: (row) => ROW_OUTCOME_LABEL[rowOutcome(row)],
        cell: ({ row }) => <OutcomeLabel row={row.original} />,
      },
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

  const summaryNote = useMemo(() => newEntitiesSummary(newEntities), [newEntities]);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/import"
        className="inline-flex w-fit items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to Import / Export
      </Link>
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
            <Link href="/records" className="font-medium underline underline-offset-2">
              View learning
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

      <OutcomePills counts={counts} total={rows.length} value={outcomeFilter} onChange={setOutcomeFilter} />
      {(batch.status === "parsed" || batch.status === "committed") && (
        <NewEntitiesList entities={newEntities} created={batch.status === "committed"} />
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by email, certificate, course studied or row number…"
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setOutcomeFilter(ALL);
        }}
      />

      <RowCards rows={visibleRows} />
      <div className="hidden md:block">
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
      </div>

      <ConfirmDialog
        open={confirming === "commit"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Import ${pluralize(importable, "row")} from ${batch.fileName}?`}
        description={commitDescription(counts)}
        confirmLabel={`Import ${pluralize(importable, "row")}`}
        pendingLabel="Importing…"
        variant="default"
        pending={pending}
        onConfirm={handleCommit}
      >
        {summaryNote && <p className="text-body text-muted-foreground">{summaryNote}</p>}
        {/* The names, not only the counts: a typo in the file would otherwise create a new member or provider unseen. */}
        <NewEntitiesList entities={newEntities} />
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming === "discard"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Discard this import batch?"
        description="The data in this batch will not be imported. You can still look at the batch afterwards."
        confirmLabel="Discard batch"
        pendingLabel="Discarding…"
        pending={pending}
        onConfirm={handleDiscard}
      />
    </div>
  );
}
