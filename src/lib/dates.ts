export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date in Vietnam as `YYYY-MM-DD`. */
export function toVnDateString(date: Date): string {
  return vnDateFormatter.format(date);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const VN_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function checkedIso(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100) return null;
  // Date.UTC rolls 31/02 over to March; comparing the parts back detects that.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `dd/mm/yyyy` (as typed) or `YYYY-MM-DD` (already parsed) → `YYYY-MM-DD`; `null` when not a real date. */
export function toIsoDate(text: string): string | null {
  const value = text.trim();
  const iso = ISO_DATE.exec(value);
  if (iso) return checkedIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const vn = VN_DATE.exec(value);
  if (vn) return checkedIso(Number(vn[3]), Number(vn[2]), Number(vn[1]));
  return null;
}

/** Today's calendar date in Vietnam as `YYYY-MM-DD`. */
export function todayVn(now: Date = new Date()): string {
  return toVnDateString(now);
}
