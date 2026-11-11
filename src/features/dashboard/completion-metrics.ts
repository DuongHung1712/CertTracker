import { isCompletion } from "@/features/records/kind";
import type { RecordRow } from "@/features/records/queries";
import { todayVn } from "@/lib/dates";

const MONTHS_PER_QUARTER = 3;

export type CompletionKpis = { doneThisMonth: number; doneThisQuarter: number; inProgress: number };

/** "2026-11-08" -> "2026-Q4": periods follow the Vietnam calendar, like the monthly figures elsewhere. */
function quarterKey(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return `${year}-Q${Math.floor((month - 1) / MONTHS_PER_QUARTER) + 1}`;
}

/** Finished completions are placed by their issued date, as certificates are. */
export function calculateCompletionKpis(records: RecordRow[], now: Date = new Date()): CompletionKpis {
  const today = todayVn(now);
  const thisMonth = today.slice(0, 7);
  const thisQuarter = quarterKey(today);
  const completions = records.filter(isCompletion);
  const finished = completions.filter((r) => r.status === "done" && r.issuedDate !== null);

  return {
    doneThisMonth: finished.filter((r) => r.issuedDate?.slice(0, 7) === thisMonth).length,
    doneThisQuarter: finished.filter((r) => r.issuedDate !== null && quarterKey(r.issuedDate) === thisQuarter).length,
    inProgress: completions.filter((r) => r.status === "in_progress").length,
  };
}
