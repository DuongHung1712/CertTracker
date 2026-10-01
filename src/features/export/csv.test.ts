import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/features/export/csv";

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and uses CRLF", () => {
    expect(toCsv(["Họ tên"], [["Nguyễn Văn An"]])).toBe("\uFEFFHọ tên\r\nNguyễn Văn An\r\n");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it("neutralises spreadsheet formulas in text but not real numbers", () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(escapeCsvCell("+84 90")).toBe("'+84 90");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("-cmd")).toBe("'-cmd");
    expect(escapeCsvCell("\tcmd")).toBe("'\tcmd");
    expect(escapeCsvCell(-5)).toBe("-5");
    expect(escapeCsvCell(null)).toBe("");
  });
});
