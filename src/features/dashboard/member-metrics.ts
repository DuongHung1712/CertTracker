import type { RecordRow } from "@/features/records/queries";
import { VN_TIME_ZONE } from "@/lib/dates";

export type MemberTab = "all" | "valid" | "expiring" | "in_progress";
export type MemberSort = "expiry" | "name";

export type AttentionUrgency = "expired" | "urgent" | "expiring";

export type AttentionRecord = {
  record: RecordRow;
  urgency: AttentionUrgency;
};

export type MemberKpis = {
  total: number;
  validCount: number;
  expiringCount: number;
  leastDaysRecord: RecordRow | null;
  inProgressCount: number;
  inProgressRows: RecordRow[];
  expiredCount: number;
};

/**
 * Given name from full name for conversational greeting.
 * Vietnamese names: last token (e.g. "Chau" from "Le Minh Chau", "An" from "Nguyen Van An").
 * Single-word names: that word. Empty fallback: "there".
 */
export function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  const tokens = trimmed.split(/\s+/);
  return tokens[tokens.length - 1];
}

/**
 * Time of day in Asia/Ho_Chi_Minh:
 * - morning: 05:00 - 11:59
 * - afternoon: 12:00 - 17:59
 * - evening: 18:00 - 04:59
 */
export function getGreetingTimeOfDay(now: Date = new Date()): "morning" | "afternoon" | "evening" {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: VN_TIME_ZONE,
    hour: "numeric",
    hour12: false,
  });
  const hour = Number.parseInt(formatter.format(now), 10);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

/**
 * Conversational greeting: "Good morning, Chau"
 */
export function getGreeting(fullName: string, now: Date = new Date()): string {
  const timeOfDay = getGreetingTimeOfDay(now);
  const firstName = extractFirstName(fullName);
  return `Good ${timeOfDay}, ${firstName}`;
}

/**
 * Day thresholds of the SQL view column `expiry_status()` (20260928000003_expiry_view.sql):
 * `< 0` Expired, `0..URGENT_WINDOW_DAYS` Expiring Soon, `..EXPIRING_WINDOW_DAYS` Expiring in 60d, above that Active.
 * Keep these in step with the SQL.
 */
export const EXPIRING_WINDOW_DAYS = 60;
export const URGENT_WINDOW_DAYS = 30;

export type ExpiryWindow = "expired" | "urgent" | "expiring" | "later" | "none";

/** Where a certificate's days-to-expiry falls; `none` means no date (No Expiry or N/A). */
export function expiryWindow(daysToExpiry: number | null): ExpiryWindow {
  if (daysToExpiry === null) return "none";
  if (daysToExpiry < 0) return "expired";
  if (daysToExpiry <= URGENT_WINDOW_DAYS) return "urgent";
  if (daysToExpiry <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "later";
}

const isDone = (r: RecordRow): boolean => r.status === "done";
const isExpired = (r: RecordRow): boolean => isDone(r) && expiryWindow(r.daysToExpiry) === "expired";
/** Done and not expired; a certificate without an expiry date counts as valid. */
const isValid = (r: RecordRow): boolean => isDone(r) && expiryWindow(r.daysToExpiry) !== "expired";
const isExpiring = (r: RecordRow): boolean => {
  const window = expiryWindow(r.daysToExpiry);
  return isDone(r) && (window === "urgent" || window === "expiring");
};
const isInProgress = (r: RecordRow): boolean => r.status === "in_progress";

const TAB_FILTERS: Record<MemberTab, (r: RecordRow) => boolean> = {
  all: () => true,
  valid: isValid,
  expiring: isExpiring,
  in_progress: isInProgress,
};

type DatedRecord = RecordRow & { daysToExpiry: number };
const hasDays = (r: RecordRow): r is DatedRecord => r.daysToExpiry !== null;

/**
 * Finds the certificate needing member attention.
 * Returns null when nothing expires within 60 days and nothing is expired.
 * Expired certificates take highest priority.
 */
export function getAttentionRecord(records: RecordRow[]): AttentionRecord | null {
  const dated = records.filter((r): r is DatedRecord => isDone(r) && r.expiryDate !== null && hasDays(r));

  // Pick the most recently expired (closest to 0)
  const expired = dated.filter(isExpired).sort((a, b) => b.daysToExpiry - a.daysToExpiry);
  if (expired.length > 0) return { record: expired[0], urgency: "expired" };

  // Otherwise the one with the least days left within the window
  const expiring = dated.filter(isExpiring).sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  if (expiring.length === 0) return null;
  const urgency: AttentionUrgency = expiryWindow(expiring[0].daysToExpiry) === "urgent" ? "urgent" : "expiring";
  return { record: expiring[0], urgency };
}

/**
 * Calculates member personal KPIs from their own records.
 */
export function calculateMemberKpis(records: RecordRow[]): MemberKpis {
  const expiringRows = records.filter((r): r is DatedRecord => isExpiring(r) && hasDays(r));
  const inProgressRows = records.filter(isInProgress);

  return {
    total: records.length,
    validCount: records.filter(isValid).length,
    expiringCount: expiringRows.length,
    leastDaysRecord: expiringRows.sort((a, b) => a.daysToExpiry - b.daysToExpiry)[0] ?? null,
    inProgressCount: inProgressRows.length,
    inProgressRows,
    expiredCount: records.filter(isExpired).length,
  };
}

/**
 * Tab counts for "My certificates" filter tabs.
 */
export function getMemberTabCounts(records: RecordRow[]): Record<MemberTab, number> {
  return {
    all: records.filter(TAB_FILTERS.all).length,
    valid: records.filter(TAB_FILTERS.valid).length,
    expiring: records.filter(TAB_FILTERS.expiring).length,
    in_progress: records.filter(TAB_FILTERS.in_progress).length,
  };
}

const collatorVi = new Intl.Collator("vi");

/**
 * Filters and sorts member records for the dashboard list.
 */
export function filterMemberRecords(
  records: RecordRow[],
  tab: MemberTab,
  sort: MemberSort = "expiry",
): RecordRow[] {
  const filtered = records.filter(TAB_FILTERS[tab]);

  return [...filtered].sort((a, b) => {
    if (sort === "name") {
      return collatorVi.compare(a.courseName, b.courseName);
    }

    // Default: sort by expiry
    // Expiring / dated records come first in ascending order of daysToExpiry
    const daysA = a.daysToExpiry;
    const daysB = b.daysToExpiry;

    if (daysA !== null && daysB !== null) {
      if (daysA !== daysB) return daysA - daysB;
      return collatorVi.compare(a.courseName, b.courseName);
    }
    if (daysA !== null && daysB === null) return -1;
    if (daysA === null && daysB !== null) return 1;

    return collatorVi.compare(a.courseName, b.courseName);
  });
}
