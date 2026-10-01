// Server-only: this module uses node:zlib, so import it from route handlers / server actions, never from client components.
import { inflateRawSync } from "node:zlib";
import * as XLSX from "xlsx";
import { cellText, findHeaderRow, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, type Cell, type Cleaned, type ImportTable } from "@/features/import/clean";

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const starts = (bytes: Uint8Array, signature: number[]) => signature.every((byte, i) => bytes[i] === byte);

/** `.xlsx` is a zip, `.xls` (and password-protected `.xlsx`) an OLE container. The file name and MIME type are not trusted. */
export function isExcelFile(bytes: Uint8Array): boolean {
  return starts(bytes, ZIP) || starts(bytes, OLE);
}

/** Total cells fillMergedCells may copy. A real sheet is ~2000 rows x ~15 columns, so this is generous for honest files. */
const MAX_MERGED_CELLS = 300_000;
/** Wider than any real import sheet (measured on the ACTUAL used range, not the declared dimension). Such a sheet is skipped. */
const MAX_IMPORT_COLUMNS = 200;
/**
 * Raw rows read from a sheet (sheetRows), blank or not. Excel writes styled-but-empty cells and a `<dimension>` far below
 * the data, so the 2000-row limit applies to NON-BLANK rows only; this larger cap just stops the reader from walking an
 * unbounded sheet. A value in the last row read means the sheet was truncated and fails closed.
 */
const MAX_RAW_ROWS = 20_000;
/** Cells holding a value, summed over every scanned sheet. 2000 rows x 200 columns is the largest honest sheet. */
const MAX_VALUE_CELLS = 400_000;
/** Only the first sheets are scanned for the header; each scanned sheet costs a sheet_to_json pass. */
const MAX_SCANNED_SHEETS = 10;

const MERGE_TOO_LARGE = "File có vùng gộp ô quá lớn.";
class MergeTooLargeError extends Error {}
class TooManyCellsError extends Error {}
const TOO_MANY_CELLS = "File có quá nhiều ô chứa dữ liệu. Chia nhỏ file rồi nhập từng phần.";
const TOO_FAR_DOWN = `Sheet có dữ liệu ở dòng quá xa (sau dòng ${MAX_RAW_ROWS}). Xóa các dòng thừa rồi thử lại.`;

const hasValue = (cell: XLSX.CellObject): boolean => {
  const v = cell.v;
  if (v === undefined || v === null) return false;
  return typeof v === "string" ? v.trim() !== "" : true;
};

/**
 * Range of the cells that actually hold a value. `!ref` comes from the file's `<dimension>`, which Excel stretches over
 * styled-but-empty cells (borders, fills), so it cannot be trusted for sizes. Returns null for a sheet without values,
 * and charges every value cell to `budget` (shared by the workbook); throws TooManyCellsError past the budget.
 */
function usedRange(sheet: XLSX.WorkSheet, budget: { remaining: number }): XLSX.Range | null {
  let range: XLSX.Range | null = null;
  for (const key in sheet) {
    if (key.charCodeAt(0) === 33 /* "!" */) continue;
    const cell = sheet[key] as XLSX.CellObject | undefined;
    if (!cell || typeof cell !== "object" || !hasValue(cell)) continue;
    if (--budget.remaining < 0) throw new TooManyCellsError(TOO_MANY_CELLS);
    const { r, c } = XLSX.utils.decode_cell(key);
    if (!range) range = { s: { r, c }, e: { r, c } };
    else {
      if (r < range.s.r) range.s.r = r;
      if (c < range.s.c) range.s.c = c;
      if (r > range.e.r) range.e.r = r;
      if (c > range.e.c) range.e.c = c;
    }
  }
  return range;
}

/**
 * Legacy sheets merge a person's name/email over their rows; copy the top-left value into every merged cell.
 * `!merges` comes straight from the (untrusted) file and SheetJS does not clip it, so every range is clamped to the
 * sheet's `!ref` (already limited to the rows read) and the copied cells are charged to `budget`, which
 * readImportTable shares across every sheet of the workbook.
 * Throws MergeTooLargeError when the budget is exceeded; readImportTable turns that into `ok: false`.
 */
export function fillMergedCells(sheet: XLSX.WorkSheet, budget: { remaining: number } = { remaining: MAX_MERGED_CELLS }): void {
  if (!sheet["!ref"]) return;
  const bounds = XLSX.utils.decode_range(sheet["!ref"]);
  for (const range of sheet["!merges"] ?? []) {
    const topLeft = sheet[XLSX.utils.encode_cell(range.s)] as XLSX.CellObject | undefined;
    if (!topLeft) continue;
    const firstRow = Math.max(range.s.r, bounds.s.r);
    const lastRow = Math.min(range.e.r, bounds.e.r);
    const firstCol = Math.max(range.s.c, bounds.s.c);
    const lastCol = Math.min(range.e.c, bounds.e.c);
    if (firstRow > lastRow || firstCol > lastCol) continue; // outside the data window
    budget.remaining -= (lastRow - firstRow + 1) * (lastCol - firstCol + 1);
    if (budget.remaining < 0) throw new MergeTooLargeError(MERGE_TOO_LARGE);
    for (let r = firstRow; r <= lastRow; r++) {
      for (let c = firstCol; c <= lastCol; c++) {
        if (r !== range.s.r || c !== range.s.c) sheet[XLSX.utils.encode_cell({ r, c })] = { ...topLeft };
      }
    }
  }
}

/** Decompressed-size ceiling for a zip (real xlsx files are well under 10 MB inflated). */
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const TOO_LARGE = "File Excel giải nén quá lớn (tối đa 50 MB). Chia nhỏ file rồi nhập từng phần.";
const BAD_ZIP = "File Excel không hợp lệ (cấu trúc zip bị hỏng).";

/**
 * Pre-parse zip-bomb guard; returns an error message or null. SheetJS 0.20.3 inflates with its own pure-JS inflater
 * (it only switches to node:zlib if `use_zlib` is called, which this repo never does), and the sizes stored in the
 * headers are attacker-controlled, so declared sizes alone prove nothing. This therefore (1) validates the central directory
 * structure and rejects absurd declared sizes / zip64 cheaply, then (2) actually inflates every deflate entry with
 * node:zlib under a hard output cap (MAX_UNCOMPRESSED_BYTES); that cap, not the declared sizes, is what bounds the
 * output. Data is read from the same offsets SheetJS uses (the local header). Anything inconsistent fails closed.
 */
function checkZip(bytes: Uint8Array): string | null {
  try {
    return inspectZip(bytes);
  } catch {
    return BAD_ZIP; // out-of-range reads or any other surprise: fail closed
  }
}

function inspectZip(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const EOCD_SIZE = 22;
  // SheetJS takes the LAST 0x06054b50 scanning back from length - 4; do the same (bounded to 64 KiB + 22) so both agree on the record.
  let eocd = -1;
  for (let i = bytes.length - 4; i >= Math.max(0, bytes.length - EOCD_SIZE - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0 || eocd + EOCD_SIZE > bytes.length) return BAD_ZIP;
  // SheetJS counts entries from +8 (this disk), we would otherwise read +10 (total); a single-disk zip has both equal.
  const entryCount = view.getUint16(eocd + 8, true);
  if (entryCount !== view.getUint16(eocd + 10, true)) return BAD_ZIP;
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return TOO_LARGE; // zip64
  // The directory must end exactly at the end record: no gap in which to hide entries SheetJS would still walk.
  if (entryCount === 0 || cdOffset + cdSize !== eocd) return BAD_ZIP;

  const entries: { dataStart: number; method: number }[] = [];
  let declared = 0;
  let at = cdOffset;
  for (let n = 0; n < entryCount; n++) {
    if (at + 46 > eocd || view.getUint32(at, true) !== 0x02014b50) return BAD_ZIP;
    const size = view.getUint32(at + 24, true);
    if (size === 0xffffffff) return TOO_LARGE; // zip64
    declared += size;
    if (declared > MAX_UNCOMPRESSED_BYTES) return TOO_LARGE;
    const localOffset = view.getUint32(at + 42, true);
    if (localOffset + 30 > cdOffset || view.getUint32(localOffset, true) !== 0x04034b50) return BAD_ZIP;
    const method = view.getUint16(localOffset + 8, true);
    if (method !== 0 && method !== 8) return BAD_ZIP; // SheetJS only supports stored and deflate
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (dataStart > cdOffset) return BAD_ZIP; // entry data must precede the directory (not hide in the end-record comment)
    entries.push({ dataStart, method });
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  if (at !== cdOffset + cdSize) return BAD_ZIP;

  let inflated = 0;
  for (const entry of entries) {
    if (entry.method !== 8) continue; // stored entries are bounded by the file size
    try {
      inflated += inflateRawSync(bytes.subarray(entry.dataStart), { maxOutputLength: Math.max(1, MAX_UNCOMPRESSED_BYTES - inflated) }).length;
    } catch (error) {
      return error instanceof RangeError ? TOO_LARGE : BAD_ZIP;
    }
  }
  return null;
}

const SCAN_ROWS = 10;

export function readImportTable(bytes: Uint8Array): Cleaned<ImportTable> {
  if (bytes.length > MAX_IMPORT_BYTES) return { ok: false, error: "File lớn hơn 4 MB. Chia nhỏ file rồi nhập từng phần." };
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    // Any "PK" prefix: SheetJS's own sniffer accepts more than PK 03 04 as a zip, so the guard must not be narrower.
    const zipError = checkZip(bytes);
    if (zipError) return { ok: false, error: zipError };
  }
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(bytes, {
      type: "array",
      sheetRows: MAX_RAW_ROWS,
      cellDates: false,    // raw serials: excelSerialToDate owns the conversion
      cellFormula: false,  // cached values only
      cellHTML: false,
      cellStyles: false,
    });
  } catch {
    return { ok: false, error: "Không đọc được file. File có thể bị hỏng hoặc được đặt mật khẩu." };
  }
  const date1904 = Boolean(book.Workbook?.WBProps?.date1904);

  const mergeBudget = { remaining: MAX_MERGED_CELLS }; // shared: bounds the whole workbook, not each sheet
  const cellBudget = { remaining: MAX_VALUE_CELLS };
  let skippedWide: string | null = null;
  for (const sheetName of book.SheetNames.slice(0, MAX_SCANNED_SHEETS)) {
    const sheet = book.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    let used: XLSX.Range | null;
    try {
      used = usedRange(sheet, cellBudget);
    } catch (error) {
      if (error instanceof TooManyCellsError) return { ok: false, error: error.message };
      throw error;
    }
    if (!used) continue; // nothing but formatting
    const declared = XLSX.utils.decode_range(sheet["!ref"]);
    // Anchor at the declared start (so "the first 10 rows" and Excel row numbers keep their meaning) but end at the last value.
    const bounds: XLSX.Range = {
      s: { r: Math.min(declared.s.r, used.s.r), c: Math.min(declared.s.c, used.s.c) },
      e: used.e,
    };
    if (bounds.e.r >= MAX_RAW_ROWS - 1) return { ok: false, error: TOO_FAR_DOWN }; // the read was cut off while still on data
    if (bounds.e.c - bounds.s.c + 1 > MAX_IMPORT_COLUMNS) {
      skippedWide ??= sheetName; // not a data sheet; reported only if no other sheet works
      continue;
    }
    sheet["!ref"] = XLSX.utils.encode_range(bounds); // everything below sees the used range, not the dimension
    try {
      fillMergedCells(sheet, mergeBudget);
    } catch (error) {
      if (error instanceof MergeTooLargeError) return { ok: false, error: error.message };
      throw error;
    }
    // blankrows: true keeps array index ↔ sheet row aligned so row numbers match Excel.
    const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true });
    const header = findHeaderRow(rows, SCAN_ROWS);
    if (!header) continue;
    if (header.duplicates.length > 0) {
      return { ok: false, error: `Cột "${header.duplicates[0]}" trùng nghĩa với một cột khác. Xóa hoặc đổi tên một trong hai.` };
    }
    const firstRow = bounds.s.r; // 0-based
    const dataRows = rows
      .slice(header.index + 1)
      .map((cells, offset) => ({ rowNumber: firstRow + header.index + 2 + offset, cells }))
      .filter((row) => row.cells.some((cell) => cellText(cell) !== null));
    if (dataRows.length > MAX_IMPORT_ROWS) {
      return { ok: false, error: `File có ${dataRows.length} dòng dữ liệu, tối đa ${MAX_IMPORT_ROWS}. Chia nhỏ file rồi nhập từng phần.` };
    }
    return {
      ok: true,
      value: {
        sheetName,
        headerRowNumber: firstRow + header.index + 1,
        headers: (rows[header.index] ?? []).map((cell, i) => cellText(cell) ?? `Cột ${i + 1}`),
        map: header.map,
        unknownColumns: header.unknown,
        rows: dataRows,
        date1904,
      },
    };
  }
  return {
    ok: false,
    error:
      "Không tìm thấy hàng tiêu đề có cột Email và Khóa học trong 10 dòng đầu của các sheet." +
      (skippedWide ? ` Sheet "${skippedWide}" bị bỏ qua vì có quá nhiều cột (hơn ${MAX_IMPORT_COLUMNS}).` : ""),
  };
}
