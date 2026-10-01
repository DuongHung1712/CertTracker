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

const BAD_ZIP_MESSAGE = "File Excel không hợp lệ (cấu trúc zip bị hỏng).";
const bomb = (megabytes: number) => deflateRawSync(new Uint8Array(megabytes * 1024 * 1024));

describe("zip guard bypasses (SheetJS and the guard must agree on the archive)", () => {
  it("rejects an end-of-central-directory whose two entry counts disagree (fake entry hidden in a gap)", () => {
    const zip = craftZip([
      { name: "a.xml", deflated: deflateRawSync(new Uint8Array(10)), declaredSize: 10 },
      { name: "xl/bomb.xml", deflated: bomb(60), declaredSize: 100 },
    ]);
    const view = new DataView(zip.buffer);
    const eocd = zip.length - 22;
    view.setUint16(eocd + 10, 1, true); // "total entries" says 1 ...
    view.setUint32(eocd + 12, 46 + "a.xml".length, true); // ... and the directory looks one entry long, leaving the bomb entry in a gap
    // SheetJS reads the count at +8 (still 2) and walks into the gap.
    expect(readImportTable(zip)).toEqual({ ok: false, error: BAD_ZIP_MESSAGE });
  });

  it("rejects a gap between the central directory and the end record", () => {
    const zip = craftZip([{ name: "a.xml", deflated: deflateRawSync(new Uint8Array(10)), declaredSize: 10 }]);
    const padded = new Uint8Array(zip.length + 10);
    padded.set(zip.subarray(0, zip.length - 22));
    padded.set(zip.subarray(zip.length - 22), padded.length - 22);
    expect(readImportTable(padded)).toEqual({ ok: false, error: BAD_ZIP_MESSAGE });
  });

  it("rejects entry data that sits in the end-record comment area", () => {
    const name = new TextEncoder().encode("xl/bomb.xml");
    const deflated = bomb(60);
    const cdSize = 46 + name.length;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(22, 100, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, cdSize + 22, true); // "extra field" long enough to jump over the directory and end record
    local.set(name, 30);
    const cd = new Uint8Array(cdSize);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(24, 100, true);
    cv.setUint16(28, name.length, true);
    cd.set(name, 46);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, 1, true);
    ev.setUint16(10, 1, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, local.length, true);
    ev.setUint16(20, deflated.length, true); // the bomb is the "comment"
    const zip = new Uint8Array(local.length + cdSize + 22 + deflated.length);
    zip.set(local);
    zip.set(cd, local.length);
    zip.set(eocd, local.length + cdSize);
    zip.set(deflated, local.length + cdSize + 22);
    const started = Date.now();
    expect(readImportTable(zip)).toEqual({ ok: false, error: BAD_ZIP_MESSAGE });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("rejects compression methods other than stored and deflate", () => {
    const zip = craftZip([{ name: "a.xml", deflated: deflateRawSync(new Uint8Array(10)), declaredSize: 10 }]);
    new DataView(zip.buffer).setUint16(8, 12, true); // local header method = bzip2
    expect(readImportTable(zip)).toEqual({ ok: false, error: BAD_ZIP_MESSAGE });
  });

  it("guards any PK-prefixed input, not only PK 03 04", () => {
    const zip = craftZip([{ name: "xl/bomb.xml", deflated: bomb(60), declaredSize: 100 }]);
    zip[2] = 1;
    zip[3] = 1; // SheetJS still treats this as a zip; it never checks the first local signature
    const started = Date.now();
    const result = readImportTable(zip);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/zip|giải nén/);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("still imports a deflate-compressed workbook", () => {
    const book = XLSX.utils.book_new();
    const rows = [["Email", "Khóa học"], ...Array.from({ length: 300 }, (_, i) => [`m${i}@x.vn`, "AWS Solutions Architect"])];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Data");
    const bytes = new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer);
    expect(new DataView(bytes.buffer).getUint16(8, true)).toBe(8); // first local entry is deflated
    const result = readImportTable(bytes);
    expect(result.ok && result.value.rows).toHaveLength(300);
  });
});

function multiSheetBytes(sheets: { name: string; aoa: unknown[][]; ref?: string; merges?: XLSX.Range[] }[]): Uint8Array {
  const book = XLSX.utils.book_new();
  for (const { name, aoa, ref, merges } of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    if (ref) sheet["!ref"] = ref;
    if (merges) sheet["!merges"] = merges;
    XLSX.utils.book_append_sheet(book, sheet, name);
  }
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

describe("workbook-wide limits", () => {
  it("shares one merge budget across sheets (several sheets with large lying merges fail fast)", () => {
    // Each merge covers 1000 rows x 200 columns = 200k cells: fine alone, over the 300k budget from the second sheet on.
    const lying = (name: string) => ({
      name,
      aoa: [["x"], ["y"]],
      ref: "A1:GR2011",
      merges: [{ s: { r: 1, c: 0 }, e: { r: 1000, c: 199 } }],
    });
    const started = Date.now();
    const result = readImportTable(multiSheetBytes(["S1", "S2", "S3", "S4", "S5"].map(lying)));
    expect(result).toEqual({ ok: false, error: "File có vùng gộp ô quá lớn." });
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("scans at most the first 10 sheets", () => {
    const junk = Array.from({ length: 10 }, (_, i) => ({ name: `J${i}`, aoa: [["a"]] }));
    const data = { name: "Data", aoa: [["Email", "Khóa học"], ["an@x.vn", "AWS"]] };
    expect(readImportTable(multiSheetBytes([...junk, data])).ok).toBe(false);
    expect(readImportTable(multiSheetBytes([...junk.slice(1), data])).ok).toBe(true);
  });

  it("skips a too-wide sheet instead of rejecting the whole file", () => {
    const wide = { name: "Wide", aoa: [Array.from({ length: 250 }, (_, i) => `Cột ${i}`)] };
    const data = { name: "Data", aoa: [["Email", "Khóa học"], ["an@x.vn", "AWS"]] };
    const result = readImportTable(multiSheetBytes([wide, data]));
    expect(result.ok && result.value.sheetName).toBe("Data");
    const onlyWide = readImportTable(multiSheetBytes([wide]));
    expect(onlyWide.ok).toBe(false);
    expect(!onlyWide.ok && onlyWide.error).toMatch(/Không tìm thấy hàng tiêu đề/);
  });
});
