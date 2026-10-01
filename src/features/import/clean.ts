import type { RecordStatus } from "@/components/status/labels";
import { REFUND_STATUS_LABEL, type RefundStatus } from "@/features/records/schema";
import { toIsoDate } from "@/lib/dates";
import { foldText } from "@/lib/text";

export type Cell = string | number | boolean | null;
export type Cleaned<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Cleaned<T> => ({ ok: true, value });
const fail = <T>(error: string): Cleaned<T> => ({ ok: false, error });

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

export const IMPORT_FIELDS = [
  "memberName", "email", "team", "courseName", "provider", "certType", "validityMonths", "status", "progress",
  "plannedExamDate", "issuedDate", "certificateUrl", "viaCompany", "refundStatus", "notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type HeaderMap = Partial<Record<ImportField, number>>;

/** Folded header text → field. Exact match only, so "Trạng thái hạn" does not become "Trạng thái". Extend after Task 8. */
export const HEADER_ALIASES: Record<ImportField, string[]> = {
  memberName: ["ho ten", "ho va ten", "ten", "full name", "name", "thanh vien", "member", "nhan vien"],
  email: ["email", "e-mail", "mail", "email cong ty"],
  team: ["team", "nhom"],
  courseName: ["khoa hoc", "ten khoa hoc", "chung chi", "ten chung chi", "course", "cert", "certification", "certificate"],
  provider: ["nha cung cap", "provider", "hang", "vendor", "to chuc cap"],
  certType: ["loai", "loai chung chi", "cert type", "certtype", "type", "linh vuc"],
  validityMonths: ["thoi han", "thoi han (thang)", "validity", "validity months", "validity (months)"],
  status: ["trang thai", "status", "tinh trang"],
  progress: ["tien do", "tien do (%)", "progress", "progress (%)", "%"],
  plannedExamDate: ["ngay thi du kien", "ngay thi", "planned exam date", "exam date", "du kien thi"],
  issuedDate: ["ngay cap", "issued date", "issue date", "ngay dat", "ngay nhan"],
  certificateUrl: ["link chung chi", "certificate url", "certificate link", "link", "url"],
  viaCompany: ["qua cong ty", "dang ky qua cong ty", "via company", "cong ty tai tro"],
  refundStatus: ["hoan tien", "trang thai hoan tien", "refund", "refund status"],
  notes: ["ghi chu", "notes", "note", "mo ta"],
};

const HEADER_LOOKUP = new Map<string, ImportField>(
  (Object.entries(HEADER_ALIASES) as [ImportField, string[]][]).flatMap(([field, aliases]) =>
    aliases.map((alias) => [alias, field] as const),
  ),
);

export type ImportTable = {
  sheetName: string;
  headerRowNumber: number;       // Excel row number, 1-based
  headers: string[];             // original header text by column index
  map: HeaderMap;
  unknownColumns: string[];
  rows: { rowNumber: number; cells: Cell[] }[];
  date1904: boolean;
};

const INVISIBLE = /[\u200b-\u200d\ufeff]/g;
const EXCEL_ERROR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!|SPILL!|CALC!)$/i;

export function cellText(cell: Cell | undefined): string | null {
  if (cell === null || cell === undefined) return null;
  const text = String(cell).replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  return text === "" || EXCEL_ERROR.test(text) ? null : text;
}

/**
 * Free text (notes): like cellText but keeps line breaks, so an exported multi-line note re-imports unchanged.
 * CR/CRLF become LF, runs of spaces/tabs collapse within a line, and the whole string is trimmed.
 */
export function normalizeNotes(cell: Cell | undefined): string | null {
  if (cell === null || cell === undefined) return null;
  const text = String(cell)
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .trim();
  return text === "" || EXCEL_ERROR.test(text) ? null : text;
}

/** Spec §6.3 `trimCertType`, applied to every catalog name (cert type, provider, course, team, member). */
export const normalizeName = (cell: Cell | undefined): string | null => cellText(cell);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** RFC 5321 path limit. Checked before the regex, which is quadratic: a 32 000-character cell took ~0.9 s. */
const MAX_EMAIL_LENGTH = 254;
export function normalizeEmail(cell: Cell | undefined): Cleaned<string> {
  const text = cellText(cell)?.replace(/^mailto:/i, "");
  if (!text) return fail("Thiếu email");
  if (text.length > MAX_EMAIL_LENGTH) return fail(`Email quá dài (tối đa ${MAX_EMAIL_LENGTH} ký tự)`);
  const email = text.toLowerCase();
  return EMAIL.test(email) ? ok(email) : fail(`Email "${text}" không hợp lệ`);
}

const STATUS_ALIASES: Record<RecordStatus, string[]> = {
  done: ["done", "completed", "complete", "hoan thanh", "da hoan thanh", "xong", "da xong", "pass", "passed",
         "dat", "da dat", "da thi dat", "certified", "co chung chi"],
  in_progress: ["in progress", "inprogress", "dang hoc", "dang lam", "dang on", "dang on thi", "studying",
                "learning", "ongoing", "doing", "wip"],
  not_started: ["not started", "chua bat dau", "chua hoc", "chua", "todo", "to do", "planned", "ke hoach", "du kien"],
};
const STATUS_LOOKUP = new Map<string, RecordStatus>(
  (Object.entries(STATUS_ALIASES) as [RecordStatus, string[]][]).flatMap(([status, aliases]) =>
    aliases.map((alias) => [alias, status] as const),
  ),
);

/** Spec §6.3 `normalizeStatus`. */
export function normalizeStatus(cell: Cell | undefined): Cleaned<RecordStatus | null> {
  const text = cellText(cell);
  if (text === null) return ok(null);
  const status = STATUS_LOOKUP.get(foldText(text.replace(/[_-]+/g, " ")));
  return status ? ok(status) : fail(`Không nhận ra trạng thái "${text}"`);
}

export function parseNumber(cell: Cell | undefined): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const text = cellText(cell);
  if (text === null) return null;
  const normalized = /^-?\d+,\d+$/.test(text) ? text.replace(",", ".") : text;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

export type ProgressMode = "fraction" | "percent";

/** Decision #23: fractions only if every numeric (non-"%") cell is within 0..1. */
export function detectProgressMode(cells: (Cell | undefined)[]): ProgressMode {
  const numbers = cells.flatMap((cell) => {
    if (typeof cell === "string" && cell.includes("%")) return [];
    const value = parseNumber(cell);
    return value === null ? [] : [value];
  });
  return numbers.length > 0 && numbers.every((value) => value >= 0 && value <= 1) ? "fraction" : "percent";
}

/** Spec §6.3 `progressToPercent`. */
export function progressToPercent(cell: Cell | undefined, mode: ProgressMode): Cleaned<number | null> {
  const text = cellText(cell);
  if (text === null) return ok(null);
  const isPercentText = text.endsWith("%");
  const value = parseNumber(isPercentText ? text.slice(0, -1) : (cell ?? null));
  if (value === null) return fail(`Tiến độ "${text}" không phải là số`);
  const scaled = isPercentText || mode === "percent" ? value : value * 100;
  // toFixed first: 0.285 * 100 is 28.499999999999996 in floating point and would round down.
  const percent = Math.round(Number(scaled.toFixed(6)));
  return percent < 0 || percent > 100 ? fail(`Tiến độ "${text}" nằm ngoài 0–100%`) : ok(percent);
}

const DAY_MS = 86_400_000;
const EPOCH_1900 = Date.UTC(1899, 11, 30);
const EPOCH_1904 = Date.UTC(1904, 0, 1);

/** Spec §6.3 `excelSerialToDate` — converts, never drops (decisions.md #11). UTC arithmetic only, so no timezone drift. */
export function excelSerialToDate(serial: number, date1904 = false): string | null {
  if (!Number.isFinite(serial)) return null;
  const iso = new Date((date1904 ? EPOCH_1904 : EPOCH_1900) + Math.floor(serial) * DAY_MS).toISOString().slice(0, 10);
  return iso >= "1990-01-01" && iso <= "2100-12-31" ? iso : null;
}

export function isoToExcelSerial(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(year, month - 1, day) - EPOCH_1900) / DAY_MS);
}

export function parseImportDate(cell: Cell | undefined, date1904: boolean): Cleaned<string | null> {
  if (typeof cell === "number") {
    const iso = excelSerialToDate(cell, date1904);
    return iso ? ok(iso) : fail(`Ngày "${cell}" không hợp lệ`);
  }
  const text = cellText(cell);
  if (text === null) return ok(null);
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const iso = excelSerialToDate(Number(text), date1904);
    return iso ? ok(iso) : fail(`Ngày "${text}" không hợp lệ`);
  }
  const datePart = text.split(" ")[0]!;
  const isoLike = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);
  const iso = isoLike
    ? toIsoDate(`${isoLike[1]}-${isoLike[2]!.padStart(2, "0")}-${isoLike[3]!.padStart(2, "0")}`)
    : toIsoDate(datePart.replace(/[.-]/g, "/"));
  return iso ? ok(iso) : fail(`Ngày "${text}" không hợp lệ (cần dd/mm/yyyy)`);
}

const TRUE_WORDS = new Set(["x", "v", "yes", "y", "true", "1", "co", "dung"]);
const FALSE_WORDS = new Set(["no", "n", "false", "0", "khong", "sai"]);

export function normalizeBoolean(cell: Cell | undefined, label: string): Cleaned<boolean | null> {
  if (typeof cell === "boolean") return ok(cell);
  const text = cellText(cell);
  if (text === null) return ok(null);
  const key = foldText(text);
  if (TRUE_WORDS.has(key)) return ok(true);
  if (FALSE_WORDS.has(key)) return ok(false);
  return fail(`${label}: không hiểu giá trị "${text}"`);
}

const REFUND_LOOKUP = new Map<string, RefundStatus>([
  ...(Object.entries(REFUND_STATUS_LABEL) as [RefundStatus, string][]).map(([status, label]) => [foldText(label), status] as const),
  ...(["n a", "na", "n/a", "khong", "n_a"] as const).map((alias) => [alias, "n_a" as const] as const),
  ...(["pending", "cho", "dang cho"] as const).map((alias) => [alias, "pending" as const] as const),
  ...(["approved", "duyet"] as const).map((alias) => [alias, "approved" as const] as const),
  ...(["rejected", "tu choi"] as const).map((alias) => [alias, "rejected" as const] as const),
  ...(["paid", "da hoan", "da tra"] as const).map((alias) => [alias, "paid" as const] as const),
]);

export function normalizeRefund(cell: Cell | undefined): Cleaned<RefundStatus | null> {
  const text = cellText(cell);
  if (text === null) return ok(null);
  const status = REFUND_LOOKUP.get(foldText(text));
  return status ? ok(status) : fail(`Không nhận ra trạng thái hoàn tiền "${text}"`);
}

export function normalizeUrl(cell: Cell | undefined): Cleaned<string | null> {
  const text = cellText(cell);
  if (text === null) return ok(null);
  return /^https?:\/\//i.test(text) && URL.canParse(text)
    ? ok(text)
    : fail("Link chứng chỉ phải bắt đầu bằng http:// hoặc https://");
}

const NO_EXPIRY_WORDS = new Set(["khong het han", "khong thoi han", "vinh vien", "no expiry", "lifetime", "none", "khong"]);

/** `null` = blank or explicitly "no expiry". */
export function parseValidityMonths(cell: Cell | undefined): Cleaned<number | null> {
  const text = cellText(cell);
  if (text === null) return ok(null);
  const key = foldText(text);
  if (NO_EXPIRY_WORDS.has(key)) return ok(null);
  const months = /^(\d+)\s*(thang|months?|m)?$/.exec(key);
  const years = /^(\d+)\s*(nam|years?|y)$/.exec(key);
  const value = months ? Number(months[1]) : years ? Number(years[1]) * 12 : NaN;
  return Number.isInteger(value) && value > 0 && value <= 600 ? ok(value) : fail(`Thời hạn "${text}" không hợp lệ`);
}

export function mapHeaders(row: (Cell | undefined)[]): { map: HeaderMap; unknown: string[]; duplicates: string[] } {
  const map: HeaderMap = {};
  const unknown: string[] = [];
  const duplicates: string[] = [];
  row.forEach((cell, index) => {
    const text = cellText(cell);
    if (text === null) return;
    const field = HEADER_LOOKUP.get(foldText(text));
    if (!field) unknown.push(text);
    else if (map[field] !== undefined) duplicates.push(text);
    else map[field] = index;
  });
  return { map, unknown, duplicates };
}

/** The first of the first `maxScan` rows that names both an email and a course column. */
export function findHeaderRow(rows: (Cell | undefined)[][], maxScan = 10) {
  for (let index = 0; index < Math.min(rows.length, maxScan); index++) {
    const mapped = mapHeaders(rows[index] ?? []);
    if (mapped.map.email !== undefined && mapped.map.courseName !== undefined) return { index, ...mapped };
  }
  return null;
}
