import { expiryMeta, type ExpiryStatus } from "@/components/status/expiry";
import type { BreakdownRow, DashboardKpis, RankingRow } from "@/features/dashboard/schema";
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
 * Chart labels state the day range. The two expiring tiers read exactly like the per-record badge
 * (`expiryMeta`); "Valid" and "Expiring within 60 days" (decision #31) are the aggregate tiles and use their own words.
 */
export const EXPIRY_BUCKET_LABELS = {
  Active: "More than 60 days",
  "Expiring in 60d": expiryMeta("Expiring in 60d").label,
  "Expiring Soon": expiryMeta("Expiring Soon").label,
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
    { key: "active", label: EXPIRY_BUCKET_LABELS.Active, count: k.activeCerts, color: "var(--status-active-fg)" },
    { key: "expiring-60", label: EXPIRY_BUCKET_LABELS["Expiring in 60d"], count: k.expiring60Certs, color: "var(--status-expiring-60-fg)" },
    { key: "expiring-soon", label: EXPIRY_BUCKET_LABELS["Expiring Soon"], count: k.expiringSoonCerts, color: "var(--status-expiring-soon-fg)" },
    { key: "no-expiry", label: EXPIRY_BUCKET_LABELS["No Expiry"], count: k.noExpiryCerts, color: "var(--status-no-expiry-fg)" },
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

export type GroupBar = { label: string; records: number };

/** The `max` biggest groups by records; every group beyond them is folded into one "Others" bar. */
export function topGroupsWithOthers(rows: BreakdownRow[], max: number): GroupBar[] {
  const sorted = [...rows].sort((a, b) => b.records - a.records);
  const top = sorted.slice(0, max).map((r) => ({ label: r.label, records: r.records }));
  const othersSum = sorted.slice(max).reduce((sum, r) => sum + r.records, 0);
  return othersSum > 0 ? [...top, { label: "Others", records: othersSum }] : top;
}

/** The `max` groups with the most expired certificates; groups with none are left out. */
export function topExpiredGroups(rows: BreakdownRow[], max: number): BreakdownRow[] {
  return rows
    .filter((r) => r.expired > 0)
    .sort((a, b) => b.expired - a.expired)
    .slice(0, max);
}

/** Axis label of at most `maxChars` characters; a longer one keeps `maxChars - 1` characters and an ellipsis. */
export function truncateLabel(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

/** Splits an axis label on its first space, so "31–60 days" is drawn as "31–60" over "days". */
export function splitTickLabel(label: string): string[] {
  const space = label.indexOf(" ");
  return space === -1 ? [label] : [label.slice(0, space), label.slice(space + 1)];
}

/** `part` of `total` as a whole percent, rounded to nearest (0 when `total` is 0). For display-only gauges; completion rates use `ratePercent`. */
export function roundedShare(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Valid vs Expired split for breakdown row detail panel. */
export function validVsExpiredSplit(counts: { valid: number; expired: number }): VisualSegment[] {
  return [
    { key: "valid", label: "Valid", count: counts.valid, color: "var(--status-active-fg)" },
    { key: "expired", label: "Expired", count: counts.expired, color: "var(--status-expired-fg)" },
  ];
}
