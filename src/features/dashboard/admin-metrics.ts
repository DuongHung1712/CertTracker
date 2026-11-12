import { URGENT_WINDOW_DAYS } from "@/features/dashboard/member-metrics";
import { isExam } from "@/features/records/kind";
import type { RecordRow } from "@/features/records/queries";
import { todayVn } from "@/lib/dates";
import { pluralize } from "@/lib/plural";

/** Most certificate rows Needs attention lists; the data quality row comes after them. */
export const ADMIN_ATTENTION_LIMIT = 10;

// Exam certificates only: a completion never expires, even when its certificate carries a validity.
const isAdminExpired = (r: RecordRow): boolean =>
  isExam(r) && r.status === "done" && r.daysToExpiry !== null && r.daysToExpiry < 0;

const isAdminExpiringUrgent = (r: RecordRow): boolean =>
  isExam(r) && r.status === "done" &&
  r.daysToExpiry !== null &&
  r.daysToExpiry >= 0 &&
  r.daysToExpiry <= URGENT_WINDOW_DAYS;

/**
 * Counts exam certificates completed with an issued date in the current calendar month
 * in Asia/Ho_Chi_Minh time.
 */
export function countIssuedThisMonth(records: RecordRow[], now: Date = new Date()): number {
  const currentMonthKey = todayVn(now).slice(0, 7);
  return records.filter((r) => isExam(r) && r.status === "done" && r.issuedDate?.slice(0, 7) === currentMonthKey).length;
}

/** Expired plus expiring-within-30-days certificates: what Needs attention would list without the limit. */
export function countAdminAttentionRecords(records: RecordRow[]): number {
  return records.filter((r) => isAdminExpired(r) || isAdminExpiringUrgent(r)).length;
}

type AttentionBase = { id: string; label: string; detail: string; href: string };

export type AdminAttentionItem =
  | (AttentionBase & { type: "expired" | "expiring_soon" })
  | (AttentionBase & { type: "data_quality"; count: number });

/**
 * Builds the "Needs attention" list for the Admin dashboard:
 * expired certificates (most overdue first), then certificates expiring within 30 days (soonest first),
 * cut to ADMIN_ATTENTION_LIMIT, then one data quality summary that the cut never drops.
 */
export function getAdminNeedsAttentionItems(
  records: RecordRow[],
  dqIssuesCount: number,
): AdminAttentionItem[] {
  const byDaysLeft = (a: RecordRow, b: RecordRow) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0);
  const certificateItem = (r: RecordRow): AdminAttentionItem => {
    const days = r.daysToExpiry ?? 0;
    const expired = days < 0;
    let detail = `Expires in ${pluralize(days, "day")}`;
    if (expired) detail = `Expired ${pluralize(-days, "day")} ago`;
    else if (days === 0) detail = "Expires today";
    return {
      id: `${expired ? "expired" : "expiring"}-${r.id}`,
      type: expired ? "expired" : "expiring_soon",
      label: `${r.memberName} · ${r.certificateName}`,
      detail,
      href: `/records?search=${encodeURIComponent(r.memberName)}`,
    };
  };

  const items = [
    ...records.filter(isAdminExpired).sort(byDaysLeft),
    ...records.filter(isAdminExpiringUrgent).sort(byDaysLeft),
  ]
    .slice(0, ADMIN_ATTENTION_LIMIT)
    .map(certificateItem);

  if (dqIssuesCount > 0) {
    items.push({
      id: "dq-issues",
      type: "data_quality",
      count: dqIssuesCount,
      label: "Data quality",
      detail: `${pluralize(dqIssuesCount, "issue")} to check`,
      href: "/data-quality",
    });
  }
  return items;
}
