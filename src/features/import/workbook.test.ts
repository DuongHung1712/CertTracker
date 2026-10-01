import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildLegacyWorkbook } from "@/features/import/__fixtures__/legacy-workbook";
import { isExcelFile, readImportTable } from "@/features/import/workbook";

function toBytes(aoa: unknown[][], options: { merges?: XLSX.Range[]; date1904?: boolean } = {}): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  if (options.merges) sheet["!merges"] = options.merges;
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Data");
  if (options.date1904) book.Workbook = { WBProps: { date1904: true } };
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

describe("isExcelFile", () => {
  it("accepts xlsx (zip) and xls (OLE) signatures only", () => {
    expect(isExcelFile(toBytes([["a"]]))).toBe(true);
    expect(isExcelFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe(true);
    expect(isExcelFile(new TextEncoder().encode("Họ tên,Email\n"))).toBe(false);
  });
});

describe("readImportTable", () => {
  it("reads the legacy fixture: header on row 3, Excel row numbers, blank rows dropped, merges filled", () => {
    const result = readImportTable(buildLegacyWorkbook());
    if (!result.ok) throw new Error(result.error);
    expect(result.value.headerRowNumber).toBe(3);
    expect(result.value.rows.map((row) => row.rowNumber)).toEqual([4, 5, 6, 7, 8, 10, 11, 12]);
    const email = result.value.map.email!;
    // Row 5 inherits An's merged email from row 4.
    expect(result.value.rows[1]!.cells[email]).toBe(result.value.rows[0]!.cells[email]);
  });

  it("keeps Excel row numbers when the used range does not start at A1", () => {
    const sheet = XLSX.utils.sheet_add_aoa({}, [["Email", "Khóa học"], ["an@x.vn", "AWS"]], { origin: "B4" });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Data");
    const result = readImportTable(new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer));
    if (!result.ok) throw new Error(result.error);
    expect(result.value.headerRowNumber).toBe(4);
    expect(result.value.rows[0]!.rowNumber).toBe(5);
  });

  it("reports the 1904 date system", () => {
    const result = readImportTable(toBytes([["Email", "Khóa học"], ["an@x.vn", "AWS"]], { date1904: true }));
    expect(result.ok && result.value.date1904).toBe(true);
  });

  it("rejects a workbook with no recognisable header", () => {
    const result = readImportTable(toBytes([["Tên", "Điểm"], ["An", 9]]));
    expect(result.ok).toBe(false);
  });

  it("rejects a header that maps one field twice", () => {
    const result = readImportTable(toBytes([["Email", "E-mail", "Khóa học"], ["a@x.vn", "a@x.vn", "AWS"]]));
    expect(result).toEqual({ ok: false, error: 'Cột "E-mail" trùng nghĩa với một cột khác. Xóa hoặc đổi tên một trong hai.' });
  });

  it("rejects more than 2000 data rows", () => {
    const rows = [["Email", "Khóa học"], ...Array.from({ length: 2001 }, (_, i) => [`m${i}@x.vn`, "AWS"])];
    expect(readImportTable(toBytes(rows)).ok).toBe(false);
  });

  it("rejects bytes that are not a readable workbook", () => {
    expect(readImportTable(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])).ok).toBe(false);
  });
});
