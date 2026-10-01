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
import { formatDateTimeVn } from "@/lib/format";
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
          <span className="sr-only">Lỗi: </span>
          <span>{message}</span>
        </li>
      ))}
      {row.warnings.map((message, index) => (
        <li key={`w${index}`} className="flex items-start gap-1.5 text-caption text-muted-foreground">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="sr-only">Cảnh báo: </span>
          <span>{message}</span>
        </li>
      ))}
    </ul>
  );
}

function committedMessage(batch: ImportBatchDetail): string {
  const when = batch.committedAt ? formatDateTimeVn(batch.committedAt) : "—";
  if (!batch.summary) return `Đã nhập lúc ${when}.`;
  const { created, updated, skipped } = batch.summary;
  return `Đã nhập lúc ${when}: tạo mới ${created}, cập nhật ${updated}, bỏ qua ${skipped}.`;
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
      { id: "rowNo", header: "Dòng", accessorFn: (row) => row.rowNo },
      { id: "email", header: "Email", accessorFn: (row) => row.raw.email ?? "", cell: ({ row }) => row.original.raw.email ?? "—" },
      {
        id: "course",
        header: "Khóa học",
        accessorFn: (row) => row.raw.course ?? "",
        cell: ({ row }) => <span className="whitespace-normal">{row.original.raw.course ?? "—"}</span>,
      },
      { id: "outcome", header: "Kết quả", accessorFn: (row) => ROW_OUTCOME_LABEL[rowOutcome(row)] },
      { id: "details", header: "Chi tiết", enableSorting: false, cell: ({ row }) => <RowMessages row={row.original} /> },
    ],
    [],
  );

  async function handleCommit() {
    setPending(true);
    const result = await commitImport({ batchId: batch.id });
    setPending(false);
    setConfirming(null);
    if (!result.ok) {
      toast.error(result.error, { duration: Infinity });
      // The batch may have changed under us (committed elsewhere); show whatever is true now.
      router.refresh();
      return;
    }
    setFinished(true);
    toast.success(`Đã nhập: tạo mới ${result.data.created}, cập nhật ${result.data.updated}`);
    router.refresh();
  }

  async function handleDiscard() {
    setPending(true);
    const result = await discardImport({ batchId: batch.id });
    setPending(false);
    setConfirming(null);
    if (!result.ok) {
      toast.error(result.error, { duration: Infinity });
      router.refresh();
      return;
    }
    setFinished(true);
    toast.success("Đã hủy lô nhập");
    router.refresh();
  }

  const description = [batch.sheetName ? `Sheet ${batch.sheetName}` : null, `tải lên lúc ${formatDateTimeVn(batch.createdAt)}`]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Lô nhập: ${batch.fileName}`}
        description={description}
        actions={
          actionable && (
            <>
              <Button variant="outline" onClick={() => setConfirming("discard")}>
                Hủy lô
              </Button>
              <Button disabled={importable === 0} onClick={() => setConfirming("commit")}>
                {`Nhập ${importable} dòng`}
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
              Xem chứng chỉ
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {batch.status === "discarded" && (
        <Alert>
          <Info aria-hidden />
          <AlertDescription className="text-foreground">Lô đã hủy.</AlertDescription>
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
        searchPlaceholder="Tìm theo email, khóa học, số dòng…"
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setOutcomeFilter(ALL);
        }}
      >
        <Select value={outcomeFilter} onValueChange={(value) => setOutcomeFilter(value ?? ALL)}>
          <SelectTrigger aria-label="Kết quả">
            <SelectValue>
              {(value: string) => (value === ALL ? "Tất cả" : isOutcome(value) ? ROW_OUTCOME_LABEL[value] : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tất cả</SelectItem>
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
            <EmptyState title="Lô này không có dòng nào" />
          ) : (
            <EmptyState title="Không tìm thấy dòng" description="Thử từ khóa khác hoặc xóa bộ lọc." />
          )
        }
      />

      <ConfirmDialog
        open={confirming === "commit"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Nhập ${importable} dòng từ ${batch.fileName}?`}
        description={`Tạo mới ${counts.create}, cập nhật ${counts.update}. ${counts.error} dòng lỗi sẽ bị bỏ qua. Chạy trong một giao dịch: lỗi ở bất kỳ dòng nào sẽ hủy toàn bộ.`}
        confirmLabel="Nhập dữ liệu"
        pendingLabel="Đang nhập…"
        pending={pending}
        onConfirm={handleCommit}
      />
      <ConfirmDialog
        open={confirming === "discard"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Hủy lô nhập này?"
        description="Dữ liệu trong lô sẽ không được nhập. Bạn vẫn xem lại được lô này."
        confirmLabel="Hủy lô"
        pending={pending}
        onConfirm={handleDiscard}
      />
    </div>
  );
}
