import type { BreakdownRow } from "@/features/dashboard/schema";
import { formatRate, ratePercent } from "@/features/dashboard/metrics";
import { pluralize } from "@/lib/plural";

export type TabResult =
  | { ok: true; data: BreakdownRow[] }
  | { ok: false; error: string };

export type TabConfig = {
  id: string;
  label: string;
  groupLabel: string;
  result: TabResult;
};

export const STATUS_FILTER_LABELS: Record<string, string> = {
  all: "Any status",
  has_expired: "With expired certificates",
  has_in_progress: "With certificates in progress",
  no_completed: "With no completed certificates",
};

/** Which groups each status filter keeps; the keys are the values of `STATUS_FILTER_LABELS`. */
const STATUS_FILTER_TESTS: Record<string, (row: BreakdownRow) => boolean> = {
  all: () => true,
  has_expired: (row) => row.expired > 0,
  has_in_progress: (row) => row.inProgress > 0,
  no_completed: (row) => row.done === 0,
};

export const MIN_RECORDS_FILTER_LABELS: Record<string, string> = {
  "0": "Any number of certificates",
  "1": "1 or more certificates",
  "5": "5 or more certificates",
  "10": "10 or more certificates",
};

export const rateOf = (row: BreakdownRow): number | null => ratePercent(row.done, row.records);

/** Whether a group passes the status filter and has at least `minRecords` certificates (an unknown filter keeps everything). */
export function matchesGroupFilters(row: BreakdownRow, statusFilter: string, minRecords: number): boolean {
  return (STATUS_FILTER_TESTS[statusFilter] ?? STATUS_FILTER_TESTS.all)(row) && row.records >= minRecords;
}

/** One line of plain text for the "Copy summary" button. */
export function copySummaryText(row: BreakdownRow): string {
  return `${row.label}: ${pluralize(row.records, "certificate")}, ${formatRate(rateOf(row))} completed (${row.done} completed, ${row.inProgress} in progress, ${row.valid} valid, ${row.expired} expired).`;
}
