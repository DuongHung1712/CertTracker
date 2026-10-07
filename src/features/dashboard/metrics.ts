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
 * "Còn hiệu lực" / "Sắp hết hạn (≤ 60 ngày)" (decision #31) span several buckets, so reusing the badge words
 * here would show different numbers under the same name.
 */
export const EXPIRY_BUCKET_LABELS = {
  Active: "Còn > 60 ngày",
  "Expiring in 60d": "Còn 31–60 ngày",
  "Expiring Soon": "Còn ≤ 30 ngày",
  Expired: "Đã hết hạn",
  "No Expiry": "Không thời hạn",
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
