import type { ExpiryStatus } from "@/components/status/expiry";
import type { DashboardKpis, RankingRow } from "@/features/dashboard/schema";
import { formatPercent } from "@/lib/format";

/** Completion % rounded DOWN; 100 only when everything is done; `null` when there is nothing to divide. */
export function ratePercent(done: number, total: number): number | null {
  if (total <= 0) return null;
  if (done >= total) return 100;
  // Integer product first: `(done / total) * 100` drifts (29/100 -> 28.999...), `done * 100` is exact.
  return Math.min(99, Math.floor((done * 100) / total));
}

export const formatRate = (rate: number | null): string => (rate === null ? "—" : formatPercent(rate));

// "Valid" = the sum of the non-expired done buckets. It equals SQL `expiry <> 'Expired'` only because the
// `done_requires_completion` CHECK keeps done records out of `N/A`.
export const validCerts = (k: DashboardKpis): number =>
  k.activeCerts + k.expiring60Certs + k.expiringSoonCerts + k.noExpiryCerts;

export const expiringCerts = (k: DashboardKpis): number => k.expiring60Certs + k.expiringSoonCerts;

export type ExpiryBucket = { status: ExpiryStatus; label: string; count: number };

/**
 * Chart labels state the day range. They are NOT the per-record badge labels (`expiryMeta`): the KPI tiles
 * "Valid" / "Expiring (≤ 60 days)" (decision #31) span several buckets, so reusing the badge words
 * here would show different numbers under the same name.
 */
export const EXPIRY_BUCKET_LABELS = {
  Active: "> 60 days left",
  "Expiring in 60d": "31–60 days left",
  "Expiring Soon": "≤ 30 days left",
  Expired: "Expired",
  "No Expiry": "No expiry",
} as const;

export function expiryBuckets(k: DashboardKpis): ExpiryBucket[] {
  const rows: [keyof typeof EXPIRY_BUCKET_LABELS, number][] = [
    ["Active", k.activeCerts],
    ["Expiring in 60d", k.expiring60Certs],
    ["Expiring Soon", k.expiringSoonCerts],
    ["Expired", k.expiredCerts],
    ["No Expiry", k.noExpiryCerts],
  ];
  return rows.map(([status, count]) => ({ status, label: EXPIRY_BUCKET_LABELS[status], count }));
}

const viCollator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

/** The SQL already orders by rank; this adds Vietnamese-aware tie order (SQL collation is not "vi"). */
export function rankingForDisplay(rows: RankingRow[]): RankingRow[] {
  return [...rows].sort(
    (a, b) => a.rank - b.rank || viCollator.compare(a.fullName, b.fullName) || a.memberCode.localeCompare(b.memberCode),
  );
}

export type VisualSegment = {
  key: string;
  label: string;
  count: number;
  color: string;
};

/** The 4 valid buckets for the "Valid" hero card stacked bar (> 60d, 31-60d, ≤ 30d, no expiry). */
export function validBuckets(k: DashboardKpis): VisualSegment[] {
  return [
    { key: "active", label: "> 60 days left", count: k.activeCerts, color: "var(--status-active-fg)" },
    { key: "expiring-60", label: "31–60 days left", count: k.expiring60Certs, color: "var(--status-expiring-60-fg)" },
    { key: "expiring-soon", label: "≤ 30 days left", count: k.expiringSoonCerts, color: "var(--status-expiring-soon-fg)" },
    { key: "no-expiry", label: "No expiry", count: k.noExpiryCerts, color: "var(--status-no-expiry-fg)" },
  ];
}

/** The 2 expiring buckets for the "Expiring (≤ 60 days)" hero card (31-60d vs ≤ 30d). */
export function expiringBuckets(k: DashboardKpis): VisualSegment[] {
  return [
    { key: "expiring-60", label: "31–60 days left", count: k.expiring60Certs, color: "var(--status-expiring-60-fg)" },
    { key: "expiring-soon", label: "≤ 30 days left", count: k.expiringSoonCerts, color: "var(--status-expiring-soon-fg)" },
  ];
}

/** Study status split (Completed, In progress, Not started) using chart tokens --chart-1..3. */
export function studyStatusSplit(counts: { done: number; inProgress: number; notStarted: number }): VisualSegment[] {
  return [
    { key: "done", label: "Completed", count: counts.done, color: "var(--chart-1)" },
    { key: "inProgress", label: "In progress", count: counts.inProgress, color: "var(--chart-2)" },
    { key: "notStarted", label: "Not started", count: counts.notStarted, color: "var(--chart-3)" },
  ];
}

/** Helper to convert DashboardKpis record counts to study status split. */
export function kpiStudyStatusSplit(k: DashboardKpis): VisualSegment[] {
  return studyStatusSplit({
    done: k.doneRecords,
    inProgress: k.inProgressRecords,
    notStarted: k.notStartedRecords,
  });
}

/** Valid vs Expired split for breakdown row detail panel. */
export function validVsExpiredSplit(counts: { valid: number; expired: number }): VisualSegment[] {
  return [
    { key: "valid", label: "Valid", count: counts.valid, color: "var(--status-active-fg)" },
    { key: "expired", label: "Expired", count: counts.expired, color: "var(--status-expired-fg)" },
  ];
}
