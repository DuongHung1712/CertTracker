const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

function parseIsoDate(iso: string): Date {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Expected YYYY-MM-DD, got "${iso}"`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls 30/02 over to March; comparing the parts back detects that.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Not a real date: "${iso}"`);
  }
  return date;
}

/** ISO-8601 week as `YYYY-Www`: weeks start on Monday and week 1 holds the year's first Thursday. */
export function isoWeekKey(iso: string): string {
  const date = parseIsoDate(iso);
  const weekday = date.getUTCDay() || 7; // Mon = 1 … Sun = 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday); // the Thursday of this week decides the ISO year
  const year = date.getUTCFullYear();
  const dayOfYear = (date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1;
  return `${year}-W${pad(Math.ceil(dayOfYear / 7))}`;
}

/** The calendar month before `todayIso`'s, as `YYYY-MM`. */
export function previousMonthKey(todayIso: string): string {
  const date = parseIsoDate(todayIso);
  const month = date.getUTCMonth(); // 0-based: for October (9) the previous month is "09"
  return month === 0 ? `${date.getUTCFullYear() - 1}-12` : `${date.getUTCFullYear()}-${pad(month)}`;
}

export function monthRange(key: string): { start: string; end: string } {
  const m = MONTH_KEY.exec(key);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error(`Expected YYYY-MM, got "${key}"`);
  const [year, month] = [Number(m[1]), Number(m[2])];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of next month = last day of this one
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
}

export const weekLabel = (key: string): string => {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) throw new Error(`Expected YYYY-Www, got "${key}"`);
  return `tuần ${m[2]}/${m[1]}`;
};

export const monthLabel = (key: string): string => {
  const { start } = monthRange(key);
  return `tháng ${start.slice(5, 7)}/${start.slice(0, 4)}`;
};
