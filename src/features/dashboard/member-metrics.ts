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
 * Finds the certificate needing member attention.
 * Returns null when nothing expires within 60 days and nothing is expired.
 * Expired certificates take highest priority.
 */
export function getAttentionRecord(records: RecordRow[]): AttentionRecord | null {
  const completed = records.filter((r) => r.status === "done" && r.expiryDate !== null && r.daysToExpiry !== null);
  if (completed.length === 0) return null;

  // 1. Check for expired certificates (< 0 days)
  const expired = completed.filter((r) => r.daysToExpiry! < 0 || r.expiryStatus === "expired");
  if (expired.length > 0) {
    // Pick the most recently expired (closest to 0 or first)
    const sorted = [...expired].sort((a, b) => b.daysToExpiry! - a.daysToExpiry!);
    return { record: sorted[0], urgency: "expired" };
  }

  // 2. Check for certificates expiring within 60 days
  const expiring = completed.filter((r) => r.daysToExpiry! >= 0 && r.daysToExpiry! <= 60);
  if (expiring.length === 0) return null;

  // Pick the one with least days left
  const leastDays = [...expiring].sort((a, b) => a.daysToExpiry! - b.daysToExpiry!)[0];
  const urgency: AttentionUrgency = leastDays.daysToExpiry! <= 30 ? "urgent" : "expiring";
  return { record: leastDays, urgency };
}

/**
 * Calculates member personal KPIs from their own records.
 */
export function calculateMemberKpis(records: RecordRow[]): MemberKpis {
  let validCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  const inProgressRows: RecordRow[] = [];
  const expiringRows: RecordRow[] = [];

  for (const r of records) {
    if (r.status === "in_progress") {
      inProgressRows.push(r);
    } else if (r.status === "done") {
      if (r.daysToExpiry !== null && r.daysToExpiry < 0) {
        expiredCount++;
      } else {
        // Valid (active, no expiry, or expiring soon)
        validCount++;
        if (r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 60) {
          expiringCount++;
          expiringRows.push(r);
        }
      }
    }
  }

  const leastDaysRecord =
    expiringRows.length > 0 ? [...expiringRows].sort((a, b) => a.daysToExpiry! - b.daysToExpiry!)[0] : null;

  return {
    total: records.length,
    validCount,
    expiringCount,
    leastDaysRecord,
    inProgressCount: inProgressRows.length,
    inProgressRows,
    expiredCount,
  };
}

/**
 * Tab counts for "My certificates" filter tabs.
 */
export function getMemberTabCounts(records: RecordRow[]): Record<MemberTab, number> {
  let valid = 0;
  let expiring = 0;
  let inProgress = 0;

  for (const r of records) {
    if (r.status === "in_progress") {
      inProgress++;
    } else if (r.status === "done") {
      if (r.daysToExpiry === null || r.daysToExpiry >= 0) {
        valid++;
        if (r.daysToExpiry !== null && r.daysToExpiry <= 60) {
          expiring++;
        }
      }
    }
  }

  return {
    all: records.length,
    valid,
    expiring,
    in_progress: inProgress,
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
  const filtered = records.filter((r) => {
    switch (tab) {
      case "all":
        return true;
      case "valid":
        return r.status === "done" && (r.daysToExpiry === null || r.daysToExpiry >= 0);
      case "expiring":
        return r.status === "done" && r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 60;
      case "in_progress":
        return r.status === "in_progress";
      default:
        return true;
    }
  });

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
