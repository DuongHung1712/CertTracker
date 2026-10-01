import * as XLSX from "xlsx";
import { cellText, findHeaderRow, MAX_IMPORT_ROWS, type Cell, type Cleaned, type ImportTable } from "@/features/import/clean";

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const starts = (bytes: Uint8Array, signature: number[]) => signature.every((byte, i) => bytes[i] === byte);

/** `.xlsx` is a zip, `.xls` (and password-protected `.xlsx`) an OLE container. The file name and MIME type are not trusted. */
export function isExcelFile(bytes: Uint8Array): boolean {
  return starts(bytes, ZIP) || starts(bytes, OLE);
}

/** Legacy sheets merge a person's name/email over their rows; copy the top-left value into every merged cell. */
export function fillMergedCells(sheet: XLSX.WorkSheet): void {
  for (const range of sheet["!merges"] ?? []) {
    const topLeft = sheet[XLSX.utils.encode_cell(range.s)] as XLSX.CellObject | undefined;
    if (!topLeft) continue;
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        if (r !== range.s.r || c !== range.s.c) sheet[XLSX.utils.encode_cell({ r, c })] = { ...topLeft };
      }
    }
  }
}

const SCAN_ROWS = 10;

export function readImportTable(bytes: Uint8Array): Cleaned<ImportTable> {
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
    fillMergedCells(sheet);
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
