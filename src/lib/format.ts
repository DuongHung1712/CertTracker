import { VN_TIME_ZONE } from "@/lib/dates";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-10-19` → `19/10/2026`. Takes a calendar date (as returned by Postgres `date`), not a timestamp. */
export function formatDate(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got ${isoDate}`);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const numberFormatter = new Intl.NumberFormat("vi-VN");

export function formatVnd(amount: number): string {
  return vndFormatter.format(amount);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

// `hourCycle: "h23"` keeps midnight as 00, not 24 (`hour12: false` alone yields "24" in some engines).
const vnDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

/** `2026-09-30T17:05:00Z` → `01/10/2026 00:05`. Takes a timestamp (e.g. `timestamptz` from Postgres) and shows it in Vietnam time. */
export function formatDateTimeVn(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${timestamp}`);
  const parts = Object.fromEntries(vnDateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
