import { deflateRawSync } from "node:zlib";
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

/** Minimal zip writer for crafting hostile archives: each entry is raw-deflated data plus the size the headers claim. */
function craftZip(entries: { name: string; deflated: Uint8Array; declaredSize: number }[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 8, true); // deflate
    lv.setUint32(18, entry.deflated.length, true);
    lv.setUint32(22, entry.declaredSize, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, entry.deflated.length, true);
    cv.setUint32(24, entry.declaredSize, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);
    parts.push(local, entry.deflated);
    offset += local.length + entry.deflated.length;
  }
  const cdSize = central.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, eocd];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) { out.set(part, at); at += part.length; }
  return out;
}

describe("merged-cell bounds (untrusted !merges)", () => {
  it("clamps a giant merge to the sheet instead of looping over ~17 billion cells", () => {
    const started = Date.now();
    const result = readImportTable(
      toBytes([["Email", "Khóa học"], ["an@x.vn", "AWS"]], { merges: [{ s: { r: 1, c: 0 }, e: { r: 1048575, c: 16383 } }] }),
    );
    expect(Date.now() - started).toBeLessThan(2000);
    // Clamped result: the merge covers the whole data window, so row 2 stays a single row.
    expect(result.ok && result.value.rows.map((row) => row.rowNumber)).toEqual([2]);
  });

  it("fails closed when merges would copy more cells than the budget", () => {
    const header = ["Email", "Khóa học", ...Array.from({ length: 98 }, (_, i) => `C${i}`)];
    const rows = [header, ...Array.from({ length: 2000 }, (_, i) => [`m${i}@x.vn`, "AWS"])];
    const whole = { s: { r: 1, c: 0 }, e: { r: 1048575, c: 16383 } };
    const started = Date.now();
    const result = readImportTable(toBytes(rows, { merges: [whole, whole, whole] }));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result).toEqual({ ok: false, error: "File có vùng gộp ô quá lớn." });
  });

  it("rejects a sheet that declares more than 200 columns", () => {
    const header = ["Email", "Khóa học", ...Array.from({ length: 200 }, (_, i) => `C${i}`)];
    const result = readImportTable(toBytes([header, ["an@x.vn", "AWS"]]));
    expect(result.ok).toBe(false);
  });

  it("still fills a normal merge (value copied down the merged rows)", () => {
    const result = readImportTable(
      toBytes([["Email", "Khóa học"], ["an@x.vn", "AWS"], [null, "GCP"]], { merges: [{ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }] }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.value.rows.map((row) => row.cells[0])).toEqual(["an@x.vn", "an@x.vn"]);
  });
});

describe("zip bomb guard (runs before XLSX.read)", () => {
  const TOO_BIG = "File Excel giải nén quá lớn (tối đa 50 MB). Chia nhỏ file rồi nhập từng phần.";

  it("rejects input larger than 4 MB", () => {
    const bytes = new Uint8Array(4 * 1024 * 1024 + 1);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    expect(readImportTable(bytes)).toEqual({ ok: false, error: "File lớn hơn 4 MB. Chia nhỏ file rồi nhập từng phần." });
  });

  it("rejects a central directory that declares a huge uncompressed size", () => {
    const zip = craftZip([{ name: "xl/sheet.xml", deflated: deflateRawSync(new Uint8Array(10)), declaredSize: 0x7fffffff }]);
    const started = Date.now();
    expect(readImportTable(zip)).toEqual({ ok: false, error: TOO_BIG });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("rejects zip64 size markers", () => {
    const zip = craftZip([{ name: "a.xml", deflated: deflateRawSync(new Uint8Array(10)), declaredSize: 0xffffffff }]);
    expect(readImportTable(zip)).toEqual({ ok: false, error: TOO_BIG });
  });

  it("rejects a stream that inflates past the cap although the headers claim it is tiny", () => {
    // SheetJS (native zlib) ignores the declared size, so declared sizes alone are not a defence.
    const deflated = deflateRawSync(new Uint8Array(60 * 1024 * 1024));
    expect(deflated.length).toBeLessThan(1024 * 1024);
    const started = Date.now();
    expect(readImportTable(craftZip([{ name: "xl/sheet.xml", deflated, declaredSize: 100 }]))).toEqual({ ok: false, error: TOO_BIG });
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("rejects a zip whose end-of-central-directory record is missing or inconsistent", () => {
    const good = craftZip([{ name: "a.xml", deflated: deflateRawSync(new Uint8Array(10)), declaredSize: 10 }]);
    const noEocd = good.slice(0, good.length - 22);
    expect(readImportTable(noEocd).ok).toBe(false);
    const badOffset = good.slice();
    new DataView(badOffset.buffer).setUint32(badOffset.length - 22 + 16, 0x00ffffff, true); // central directory offset out of range
    expect(readImportTable(badOffset).ok).toBe(false);
    const badCount = good.slice();
    new DataView(badCount.buffer).setUint16(badCount.length - 22 + 10, 5, true); // claims 5 entries, has 1
    expect(readImportTable(badCount).ok).toBe(false);
  });

  it("does not apply the zip check to OLE input", () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 9, 9, 9, 9]);
    expect(readImportTable(ole)).toEqual({ ok: false, error: "Không đọc được file. File có thể bị hỏng hoặc được đặt mật khẩu." });
  });
});
