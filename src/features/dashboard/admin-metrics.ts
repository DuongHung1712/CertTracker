import {
  EXPIRING_WINDOW_DAYS,
  URGENT_WINDOW_DAYS,
} from "@/features/dashboard/member-metrics";
import type { RecordRow } from "@/features/records/queries";
import { todayVn } from "@/lib/dates";
import { pluralize } from "@/lib/plural";

export { EXPIRING_WINDOW_DAYS, URGENT_WINDOW_DAYS };

export const isDoneRecord = (r: RecordRow): boolean => r.status === "done";

/** Completed and expiry date is strictly in the past (< 0 days). */
export function isAdminExpired(r: RecordRow): boolean {
  return isDoneRecord(r) && r.daysToExpiry !== null && r.daysToExpiry < 0;
}

/** Completed and expires within 0 to 30 days inclusive. */
export function isAdminExpiringUrgent(r: RecordRow): boolean {
  return (
    isDoneRecord(r) &&
    r.daysToExpiry !== null &&
    r.daysToExpiry >= 0 &&
    r.daysToExpiry <= URGENT_WINDOW_DAYS
  );
}

/** Completed and expires within 0 to 60 days inclusive. */
export function isAdminExpiring60(r: RecordRow): boolean {
  return (
    isDoneRecord(r) &&
    r.daysToExpiry !== null &&
    r.daysToExpiry >= 0 &&
    r.daysToExpiry <= EXPIRING_WINDOW_DAYS
  );
}

/** Completed and not expired (daysToExpiry === null or >= 0). */
export function isAdminValid(r: RecordRow): boolean {
  return isDoneRecord(r) && (r.daysToExpiry === null || r.daysToExpiry >= 0);
}

/**
 * Counts certificates completed with an issued date in the current calendar month
 * in Asia/Ho_Chi_Minh time.
 */
export function countIssuedThisMonth(
  records: RecordRow[],
  now: Date = new Date(),
): number {
  const currentMonthKey = todayVn(now).slice(0, 7);
  let count = 0;
  for (const r of records) {
    if (r.status === "done" && r.issuedDate && r.issuedDate.slice(0, 7) === currentMonthKey) {
      count++;
    }
  }
  return count;
}

export type AdminAttentionItem =
  | {
      id: string;
      type: "expired";
      record: RecordRow;
      label: string;
      detail: string;
      href: string;
    }
  | {
      id: string;
      type: "expiring_soon";
      record: RecordRow;
      label: string;
      detail: string;
      href: string;
    }
  | {
      id: string;
      type: "data_quality";
      count: number;
      label: string;
      detail: string;
      href: string;
    };

/**
 * Builds the real "Needs attention" list for the Admin dashboard:
 * 1. Expired certificates (most overdue first, i.e. lowest negative daysToExpiry).
 * 2. Certificates expiring within 30 days (soonest first).
 * 3. Data quality issues (one summary item pointing to /data-quality if count > 0).
 */
export function getAdminNeedsAttentionItems(
  records: RecordRow[],
  dqIssuesCount: number,
  limit = 10,
): AdminAttentionItem[] {
  const items: AdminAttentionItem[] = [];

  // 1. Expired certificates
  const expiredRecords = records
    .filter(isAdminExpired)
    .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));

  for (const r of expiredRecords) {
    const overdueDays = -(r.daysToExpiry ?? 0);
    items.push({
      id: `expired-${r.id}`,
      type: "expired",
      record: r,
      label: `${r.memberName} · ${r.courseName}`,
      detail: `Expired ${pluralize(overdueDays, "day")} ago`,
      href: `/records?search=${encodeURIComponent(r.memberName)}`,
    });
  }

  // 2. Urgent expiring certificates (0..30 days)
  const urgentRecords = records
    .filter(isAdminExpiringUrgent)
    .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));

  for (const r of urgentRecords) {
    const days = r.daysToExpiry ?? 0;
    const detail = days === 0 ? "Expires today" : `Expires in ${pluralize(days, "day")}`;
    items.push({
      id: `expiring-${r.id}`,
      type: "expiring_soon",
      record: r,
      label: `${r.memberName} · ${r.courseName}`,
      detail,
      href: `/records?search=${encodeURIComponent(r.memberName)}`,
    });
  }

  // 3. Data quality findings
  if (dqIssuesCount > 0) {
    const issueWord = pluralize(dqIssuesCount, "issue");
    const verb = dqIssuesCount === 1 ? "requires" : "require";
    items.push({
      id: "dq-issues",
      type: "data_quality",
      count: dqIssuesCount,
      label: "Data quality issues",
      detail: `${issueWord} ${verb} attention`,
      href: "/data-quality",
    });
  }

  return items.slice(0, limit);
}
