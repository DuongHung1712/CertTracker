import type { BreakdownRow } from "@/features/dashboard/schema";
import { ratePercent } from "@/features/dashboard/metrics";

export type TabResult =
  | { ok: true; data: BreakdownRow[] }
  | { ok: false; error: string };

export type TabConfig = {
  id: string;
  label: string;
  groupLabel: string;
  peopleLabel: string;
  result: TabResult;
};

export const STATUS_FILTER_LABELS: Record<string, string> = {
  all: "All groups",
  has_expired: "Has expired certificates",
  has_in_progress: "Has in-progress",
  no_completed: "No completed yet",
};

export const MIN_RECORDS_FILTER_LABELS: Record<string, string> = {
  "0": "Min records: Any",
  "1": "1+ records",
  "5": "5+ records",
  "10": "10+ records",
};

export const rateOf = (row: BreakdownRow): number | null => ratePercent(row.done, row.records);
