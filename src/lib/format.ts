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
