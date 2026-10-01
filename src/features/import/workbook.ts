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
/** Wider than any real import sheet; keeps sheet_to_json from materialising 16 384-column rows. */
const MAX_IMPORT_COLUMNS = 200;

const MERGE_TOO_LARGE = "File có vùng gộp ô quá lớn.";
class MergeTooLargeError extends Error {}

/**
 * Legacy sheets merge a person's name/email over their rows; copy the top-left value into every merged cell.
 * `!merges` comes straight from the (untrusted) file and SheetJS does not clip it, so every range is clamped to the
 * sheet's `!ref` (already limited to the rows read) and the copied cells are budgeted.
 * Throws MergeTooLargeError when the budget is exceeded; readImportTable turns that into `ok: false`.
 */
export function fillMergedCells(sheet: XLSX.WorkSheet): void {
  if (!sheet["!ref"]) return;
  const bounds = XLSX.utils.decode_range(sheet["!ref"]);
  let budget = MAX_MERGED_CELLS;
  for (const range of sheet["!merges"] ?? []) {
    const topLeft = sheet[XLSX.utils.encode_cell(range.s)] as XLSX.CellObject | undefined;
    if (!topLeft) continue;
    const firstRow = Math.max(range.s.r, bounds.s.r);
    const lastRow = Math.min(range.e.r, bounds.e.r);
    const firstCol = Math.max(range.s.c, bounds.s.c);
    const lastCol = Math.min(range.e.c, bounds.e.c);
    if (firstRow > lastRow || firstCol > lastCol) continue; // outside the data window
    budget -= (lastRow - firstRow + 1) * (lastCol - firstCol + 1);
    if (budget < 0) throw new MergeTooLargeError(MERGE_TOO_LARGE);
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
 * Pre-parse zip-bomb guard; returns an error message or null. SheetJS inflates whole entries and, with native zlib,
 * ignores the sizes stored in the headers, so declared sizes alone prove nothing. This therefore (1) validates the
 * central directory structure and rejects absurd declared sizes / zip64 cheaply, then (2) actually inflates every
 * deflate entry with a hard output cap, reading data from the same offsets SheetJS uses (the local header).
 * Anything inconsistent fails closed.
 */
function checkZip(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const EOCD_SIZE = 22;
  // End-of-central-directory record: last 0x06054b50 within the final 64 KiB (max comment) + 22 bytes.
  let eocd = -1;
  for (let i = bytes.length - EOCD_SIZE; i >= Math.max(0, bytes.length - EOCD_SIZE - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return BAD_ZIP;
  const entryCount = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return TOO_LARGE; // zip64
  if (entryCount === 0 || cdOffset + cdSize > eocd) return BAD_ZIP;

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
    entries.push({
      method: view.getUint16(localOffset + 8, true),
      dataStart: localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true),
    });
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  if (at !== cdOffset + cdSize) return BAD_ZIP;

  let inflated = 0;
  for (const entry of entries) {
    if (entry.method !== 8 || entry.dataStart > cdOffset) continue; // stored entries are bounded by the file size
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
  if (starts(bytes, ZIP)) {
    const zipError = checkZip(bytes);
    if (zipError) return { ok: false, error: zipError };
  }
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(bytes, {
      type: "array",
      sheetRows: MAX_IMPORT_ROWS + SCAN_ROWS + 1,
      cellDates: false,    // raw serials: excelSerialToDate owns the conversion
      cellFormula: false,  // cached values only
      cellHTML: false,
      cellStyles: false,
    });
  } catch {
    return { ok: false, error: "Không đọc được file. File có thể bị hỏng hoặc được đặt mật khẩu." };
  }
  const date1904 = Boolean(book.Workbook?.WBProps?.date1904);

  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    if (XLSX.utils.decode_range(sheet["!ref"]).e.c >= MAX_IMPORT_COLUMNS) {
      return { ok: false, error: `File có hơn ${MAX_IMPORT_COLUMNS} cột. Xóa các cột thừa rồi nhập lại.` };
    }
    try {
      fillMergedCells(sheet);
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
    if (rows.length >= MAX_IMPORT_ROWS + SCAN_ROWS + 1) {
      return { ok: false, error: `File có hơn ${MAX_IMPORT_ROWS} dòng dữ liệu. Chia nhỏ file rồi nhập từng phần.` };
    }
    const firstRow = XLSX.utils.decode_range(sheet["!ref"]).s.r; // 0-based
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
    error: "Không tìm thấy hàng tiêu đề có cột Email và Khóa học trong 10 dòng đầu của các sheet.",
  };
}
