import { formatDate } from "@/lib/format";
import { pluralize } from "@/lib/plural";

export const EXPIRY_STATUSES = ["Active", "Expiring in 60d", "Expiring Soon", "Expired", "No Expiry", "N/A"] as const;

export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];
export type ExpiryTone = "active" | "expiring-60" | "expiring-soon" | "expired" | "no-expiry" | "na";

const META: Record<ExpiryStatus, { tone: ExpiryTone; label: string }> = {
  Active: { tone: "active", label: "Valid" },
  "Expiring in 60d": { tone: "expiring-60", label: "Expires in 31–60 days" },
  "Expiring Soon": { tone: "expiring-soon", label: "Expires within 30 days" },
  Expired: { tone: "expired", label: "Expired" },
  "No Expiry": { tone: "no-expiry", label: "No expiry" },
  "N/A": { tone: "na", label: "Not issued yet" },
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
  if (status === "No Expiry") return "This certificate does not expire";
  if (status === "N/A" || daysToExpiry === null || expiryDate === null) return "Not issued yet";
  const date = formatDate(expiryDate);
  if (daysToExpiry < 0) return `Expired ${pluralize(-daysToExpiry, "day")} ago · ${date}`;
  if (daysToExpiry === 0) return `Expires today · ${date}`;
  return `${pluralize(daysToExpiry, "day")} left · expires ${date}`;
}
