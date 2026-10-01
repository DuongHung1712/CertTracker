import { describe, expect, it } from "vitest";
import {
  cellText, normalizeNotes, detectProgressMode, excelSerialToDate, findHeaderRow, isoToExcelSerial, mapHeaders, normalizeBoolean,
  normalizeEmail, normalizeName, normalizeRefund, normalizeStatus, normalizeUrl, parseImportDate, parseNumber,
  parseValidityMonths, progressToPercent,
} from "@/features/import/clean";

describe("cellText / normalizeName (spec: trimCertType)", () => {
  it("trims, collapses whitespace and removes invisible characters", () => {
    expect(normalizeName("  Cloud  ")).toBe("Cloud");
    expect(normalizeName("Azure  Fundamentals")).toBe("Azure Fundamentals");
    expect(normalizeName("AWS\u200b")).toBe("AWS");
  });
  it("treats blanks and Excel error text as empty", () => {
    expect(cellText("   ")).toBeNull();
    expect(cellText("#N/A")).toBeNull();
    expect(cellText(null)).toBeNull();
    expect(cellText(0)).toBe("0");
  });
});

describe("normalizeNotes", () => {
  it("keeps line breaks and normalises CR/CRLF to LF", () => {
    expect(normalizeNotes("dòng 1\ndòng 2")).toBe("dòng 1\ndòng 2");
    expect(normalizeNotes("a\r\nb")).toBe("a\nb");
    expect(normalizeNotes("a\rb")).toBe("a\nb");
  });
  it("collapses spaces and tabs within lines only, and trims", () => {
    expect(normalizeNotes("  a   b \t c  \n   d  \n")).toBe("a b c\nd");
  });
  it("returns null for blank, whitespace-only, invisible-only and Excel-error text", () => {
    expect(normalizeNotes(null)).toBeNull();
    expect(normalizeNotes(" \n \r\n ")).toBeNull();
    expect(normalizeNotes("\u200b\ufeff")).toBeNull();
    expect(normalizeNotes("#N/A")).toBeNull();
  });
  it("strips invisible characters and stringifies numbers", () => {
    expect(normalizeNotes("a\u200bb")).toBe("ab");
    expect(normalizeNotes(42)).toBe("42");
  });
});

describe("normalizeStatus", () => {
  it.each([
    ["Done", "done"], ["Completed", "done"], ["Hoàn thành", "done"], ["xong", "done"], ["Đã đạt", "done"],
    ["In Progress", "in_progress"], ["in_progress", "in_progress"], ["Đang học", "in_progress"], ["đang ôn thi", "in_progress"],
    ["Not Started", "not_started"], ["chưa bắt đầu", "not_started"], ["TODO", "not_started"],
  ])("maps %s", (input, expected) => {
    expect(normalizeStatus(input)).toEqual({ ok: true, value: expected });
  });
  it("returns null for blank and an error for unknown text", () => {
    expect(normalizeStatus("")).toEqual({ ok: true, value: null });
    expect(normalizeStatus("Failed")).toEqual({ ok: false, error: 'Không nhận ra trạng thái "Failed"' });
  });
});

describe("progress", () => {
  it("parses numbers, numeric text and a Vietnamese decimal comma", () => {
    expect(parseNumber(0.75)).toBe(0.75);
    expect(parseNumber("75")).toBe(75);
    expect(parseNumber("0,75")).toBe(0.75);
    expect(parseNumber("abc")).toBeNull();
  });
  it("uses fraction mode only when every numeric cell is within 0..1", () => {
    expect(detectProgressMode([0.5, 1, 0, null, "45%"])).toBe("fraction");
    expect(detectProgressMode([0.5, 40])).toBe("percent");
    expect(detectProgressMode([null, "abc"])).toBe("percent");
  });
  it("converts to an integer percentage", () => {
    expect(progressToPercent(0.75, "fraction")).toEqual({ ok: true, value: 75 });
    expect(progressToPercent(1, "fraction")).toEqual({ ok: true, value: 100 });
    expect(progressToPercent(75, "percent")).toEqual({ ok: true, value: 75 });
    expect(progressToPercent("45%", "fraction")).toEqual({ ok: true, value: 45 });
    expect(progressToPercent(0.285, "fraction")).toEqual({ ok: true, value: 29 });
    expect(progressToPercent(null, "percent")).toEqual({ ok: true, value: null });
  });
  it("rejects out-of-range and non-numeric values", () => {
    expect(progressToPercent(150, "percent").ok).toBe(false);
    expect(progressToPercent(-5, "percent").ok).toBe(false);
    expect(progressToPercent("nhiều", "percent").ok).toBe(false);
  });
});

describe("dates", () => {
  it("converts Excel serials (1900 and 1904 systems) without timezone drift", () => {
    expect(excelSerialToDate(44927)).toBe("2023-01-01");
    expect(excelSerialToDate(45000)).toBe("2023-03-15");
    expect(excelSerialToDate(45658.75)).toBe("2025-01-01");
    expect(excelSerialToDate(43465, true)).toBe("2023-01-01");
  });
  it("rejects serials outside 1990..2100", () => {
    expect(excelSerialToDate(100)).toBeNull();
    expect(excelSerialToDate(99999)).toBeNull();
  });
  it("round-trips ISO dates through serials", () => {
    expect(excelSerialToDate(isoToExcelSerial("2026-02-28"))).toBe("2026-02-28");
    expect(isoToExcelSerial("2023-01-01")).toBe(44927);
  });
  it("parses the text formats seen in legacy sheets", () => {
    expect(parseImportDate("01/08/2025", false)).toEqual({ ok: true, value: "2025-08-01" });
    expect(parseImportDate("1-8-2025", false)).toEqual({ ok: true, value: "2025-08-01" });
    expect(parseImportDate("01.08.2025", false)).toEqual({ ok: true, value: "2025-08-01" });
    expect(parseImportDate("2025-08-01", false)).toEqual({ ok: true, value: "2025-08-01" });
    expect(parseImportDate("01/08/2025 00:00:00", false)).toEqual({ ok: true, value: "2025-08-01" });
    expect(parseImportDate("45000", false)).toEqual({ ok: true, value: "2023-03-15" });
    expect(parseImportDate(45000, false)).toEqual({ ok: true, value: "2023-03-15" });
    expect(parseImportDate("", false)).toEqual({ ok: true, value: null });
  });
  it("rejects impossible and month-first dates", () => {
    expect(parseImportDate("31/02/2025", false).ok).toBe(false);
    expect(parseImportDate("08/25/2025", false).ok).toBe(false);
    expect(parseImportDate("sớm", false).ok).toBe(false);
  });
});

describe("other fields", () => {
  it("normalizes email and rejects malformed ones", () => {
    expect(normalizeEmail("  AN@Certtracker.Test ")).toEqual({ ok: true, value: "an@certtracker.test" });
    expect(normalizeEmail("mailto:an@x.vn")).toEqual({ ok: true, value: "an@x.vn" });
    expect(normalizeEmail("")).toEqual({ ok: false, error: "Thiếu email" });
    expect(normalizeEmail("an@").ok).toBe(false);
    const tooLong = `${"a".repeat(250)}@x.vn`; // 255 characters
    expect(normalizeEmail(tooLong)).toEqual({ ok: false, error: "Email quá dài (tối đa 254 ký tự)" });
    expect(normalizeEmail(`${"a".repeat(249)}@x.vn`).ok).toBe(true); // 254 characters
    const started = Date.now();
    expect(normalizeEmail("a@".repeat(16_000)).ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(100); // never reaches the regex
  });
  it("reads booleans", () => {
    expect(normalizeBoolean("x", "Qua công ty")).toEqual({ ok: true, value: true });
    expect(normalizeBoolean("Có", "Qua công ty")).toEqual({ ok: true, value: true });
    expect(normalizeBoolean("Không", "Qua công ty")).toEqual({ ok: true, value: false });
    expect(normalizeBoolean(1, "Qua công ty")).toEqual({ ok: true, value: true });
    expect(normalizeBoolean("", "Qua công ty")).toEqual({ ok: true, value: null });
    expect(normalizeBoolean("maybe", "Qua công ty").ok).toBe(false);
  });
  it("reads refund statuses including the export labels", () => {
    expect(normalizeRefund("Đã hoàn tiền")).toEqual({ ok: true, value: "paid" });
    expect(normalizeRefund("Không áp dụng")).toEqual({ ok: true, value: "n_a" });
    expect(normalizeRefund("pending")).toEqual({ ok: true, value: "pending" });
    expect(normalizeRefund("?").ok).toBe(false);
  });
  it("accepts only http(s) links", () => {
    expect(normalizeUrl("https://credly.com/b/1")).toEqual({ ok: true, value: "https://credly.com/b/1" });
    expect(normalizeUrl("javascript:alert(1)").ok).toBe(false);
    expect(normalizeUrl("")).toEqual({ ok: true, value: null });
  });
  it("reads validity in months or years, and no-expiry words", () => {
    expect(parseValidityMonths(36)).toEqual({ ok: true, value: 36 });
    expect(parseValidityMonths("24 tháng")).toEqual({ ok: true, value: 24 });
    expect(parseValidityMonths("3 năm")).toEqual({ ok: true, value: 36 });
    expect(parseValidityMonths("Không hết hạn")).toEqual({ ok: true, value: null });
    expect(parseValidityMonths("")).toEqual({ ok: true, value: null });
    expect(parseValidityMonths("0").ok).toBe(false);
  });
});

describe("headers", () => {
  it("maps Vietnamese and English headers exactly, ignoring case and diacritics", () => {
    const { map, unknown, duplicates } = mapHeaders(["STT", "Họ và tên", "EMAIL", "Chứng chỉ", "Trạng thái", "Trạng thái hạn"]);
    expect(map).toEqual({ memberName: 1, email: 2, courseName: 3, status: 4 });
    expect(unknown).toEqual(["STT", "Trạng thái hạn"]);
    expect(duplicates).toEqual([]);
  });
  it("reports a field mapped twice", () => {
    expect(mapHeaders(["Email", "E-mail", "Khóa học"]).duplicates).toEqual(["E-mail"]);
  });
  it("finds a header row below title rows", () => {
    const rows = [["DANH SÁCH CHỨNG CHỈ"], [], ["Họ tên", "Email", "Khóa học"], ["An", "an@x.vn", "AWS"]];
    expect(findHeaderRow(rows)?.index).toBe(2);
    expect(findHeaderRow([["a"], ["b"]])).toBeNull();
  });
});
