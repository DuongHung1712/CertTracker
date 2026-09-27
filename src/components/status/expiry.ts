import { formatDate } from "@/lib/format";

export const EXPIRY_STATUSES = ["Active", "Expiring in 60d", "Expiring Soon", "Expired", "No Expiry", "N/A"] as const;

export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];
export type ExpiryTone = "active" | "expiring-60" | "expiring-soon" | "expired" | "no-expiry" | "na";

const META: Record<ExpiryStatus, { tone: ExpiryTone; label: string }> = {
  Active: { tone: "active", label: "Còn hiệu lực" },
  "Expiring in 60d": { tone: "expiring-60", label: "Hết hạn trong 60 ngày" },
  "Expiring Soon": { tone: "expiring-soon", label: "Sắp hết hạn" },
  Expired: { tone: "expired", label: "Đã hết hạn" },
  "No Expiry": { tone: "no-expiry", label: "Không thời hạn" },
  "N/A": { tone: "na", label: "Chưa cấp" },
};

/** Narrows the `expiry_status` text column of `v_training_records`. */
export function toExpiryStatus(value: string | null | undefined): ExpiryStatus {
  return (EXPIRY_STATUSES as readonly string[]).includes(value ?? "") ? (value as ExpiryStatus) : "N/A";
}

export function expiryMeta(status: ExpiryStatus): { tone: ExpiryTone; label: string } {
  return META[status];
}

export function expiryDetail({
  status,
  daysToExpiry,
  expiryDate,
}: {
  status: ExpiryStatus;
  daysToExpiry: number | null;
  expiryDate: string | null;
}): string {
  if (status === "No Expiry") return "Chứng chỉ không có thời hạn";
  if (status === "N/A" || daysToExpiry === null || expiryDate === null) return "Chưa có ngày cấp";
  const date = formatDate(expiryDate);
  if (daysToExpiry < 0) return `Đã hết hạn ${-daysToExpiry} ngày · ${date}`;
  if (daysToExpiry === 0) return `Hết hạn hôm nay · ${date}`;
  return `Còn ${daysToExpiry} ngày · hết hạn ${date}`;
}
