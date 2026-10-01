import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { mapHeaders } from "@/features/import/clean";
import { buildImportPlan, type ImportLookups } from "@/features/import/plan";
import { readImportTable } from "@/features/import/workbook";
import type { RecordRow } from "@/features/records/queries";
import { EXPORT_COLUMNS, recordsToCsv, recordsToXlsx } from "@/features/export/records-export";

const NOTE = "Dòng một\nDòng hai\n\nDòng bốn";

const ROWS: RecordRow[] = [
  { id: "r1", memberId: "an", memberCode: "M001", memberName: "Nguyễn Văn An", memberEmail: "an@x.vn", teamId: "cloud", teamName: "Team Cloud", courseId: "saa", courseName: "AWS SAA", certTypeName: "Cloud", providerName: "AWS", validityMonths: 36, status: "done", progress: 100, plannedExamDate: null, issuedDate: "2024-02-29", certificateUrl: "https://credly.com/b/1", hasEvidence: false, viaCompany: true, refundStatus: "paid", notes: "=cần kiểm tra", expiryDate: "2027-02-28", daysToExpiry: 150, expiryStatus: "Active" },
  { id: "r2", memberId: "an", memberCode: "M001", memberName: "Nguyễn Văn An", memberEmail: "an@x.vn", teamId: "cloud", teamName: "Team Cloud", courseId: "gcp", courseName: "GCP ACE", certTypeName: null, providerName: "Google", validityMonths: null, status: "in_progress", progress: 1, plannedExamDate: "2026-12-01", issuedDate: null, certificateUrl: null, hasEvidence: false, viaCompany: false, refundStatus: "n_a", notes: null, expiryDate: null, daysToExpiry: null, expiryStatus: "No Expiry" },
  { id: "r3", memberId: "an", memberCode: "M001", memberName: "Nguyễn Văn An", memberEmail: "an@x.vn", teamId: "cloud", teamName: "Team Cloud", courseId: "az", courseName: "Azure AZ-900", certTypeName: "Cloud", providerName: "AWS", validityMonths: 12, status: "in_progress", progress: 55, plannedExamDate: null, issuedDate: null, certificateUrl: null, hasEvidence: false, viaCompany: false, refundStatus: "pending", notes: NOTE, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" },
];

const baseRecord = (row: RecordRow) => ({
  id: row.id, memberId: row.memberId, courseId: row.courseId, status: row.status, progress: row.progress,
  plannedExamDate: row.plannedExamDate, issuedDate: row.issuedDate, certificateUrl: row.certificateUrl,
  viaCompany: row.viaCompany, refundStatus: row.refundStatus, notes: row.notes,
});

const LOOKUPS: ImportLookups = {
  members: [{ id: "an", email: "an@x.vn", fullName: "Nguyễn Văn An", teamId: "cloud", isActive: true }],
  teams: [{ id: "cloud", name: "Team Cloud" }],
  providers: [{ id: "aws", name: "AWS" }, { id: "google", name: "Google" }],
  certTypes: [{ id: "tc", name: "Cloud" }],
  courses: [
    { id: "saa", name: "AWS SAA", providerId: "aws", certTypeId: "tc", validityMonths: 36 },
    { id: "gcp", name: "GCP ACE", providerId: "google", certTypeId: null, validityMonths: null },
    { id: "az", name: "Azure AZ-900", providerId: "aws", certTypeId: "tc", validityMonths: 12 },
  ],
  records: ROWS.map(baseRecord),
};

const actions = (rows: RecordRow[], lookups: ImportLookups = LOOKUPS) => {
  const table = readImportTable(recordsToXlsx(rows));
  if (!table.ok) throw new Error(table.error);
  return buildImportPlan(table.value, lookups, "2026-09-30").rows.map((row) => [row.action, row.errors]);
};

const lookupsFor = (rows: RecordRow[]): ImportLookups => ({ ...LOOKUPS, records: rows.map(baseRecord) });

describe("records export", () => {
  it("re-imports an exported workbook with zero changes (1% progress, leap day, multi-line note)", () => {
    expect(actions(ROWS)).toEqual([["skip", []], ["skip", []], ["skip", []]]);
  });

  it("keeps the line breaks of a note intact in the workbook cell", () => {
    const book = XLSX.read(recordsToXlsx(ROWS), { type: "array" });
    const sheet = book.Sheets["Chứng chỉ"]!;
    const column = EXPORT_COLUMNS.findIndex((c) => c.header === "Ghi chú");
    expect(sheet[XLSX.utils.encode_cell({ r: 3, c: column })]?.v).toBe(NOTE);
  });

  it("round-trips a column where every progress is exactly 100%", () => {
    const rows = ROWS.map((row) => ({ ...row, status: "done" as const, progress: 100, issuedDate: row.issuedDate ?? "2025-03-01" }));
    expect(actions(rows, lookupsFor(rows))).toEqual([["skip", []], ["skip", []], ["skip", []]]);
  });

  it("round-trips a column holding only 0% and 100%", () => {
    const idle = { status: "not_started" as const, progress: 0 };
    const rows = [{ ...ROWS[0]!, progress: 100 }, { ...ROWS[1]!, ...idle }, { ...ROWS[2]!, ...idle }];
    expect(actions(rows, lookupsFor(rows))).toEqual([["skip", []], ["skip", []], ["skip", []]]);
  });

  it("writes real date cells and percent cells in the workbook", () => {
    const book = XLSX.read(recordsToXlsx(ROWS), { type: "array", cellDates: true });
    const sheet = book.Sheets["Chứng chỉ"]!;
    const col = (header: string) => EXPORT_COLUMNS.findIndex((c) => c.header === header);
    const issued = sheet[XLSX.utils.encode_cell({ r: 1, c: col("Ngày cấp") })]!;
    expect(issued.t).toBe("d");
    expect(issued.w).toBe("29/02/2024");
    const progress = sheet[XLSX.utils.encode_cell({ r: 2, c: col("Tiến độ (%)") })]!;
    expect(progress.v).toBeCloseTo(0.01);
    expect(progress.w).toBe("1%");
  });

  it("maps import headers through the aliases and leaves display-only columns unmapped", () => {
    const { map, unknown, duplicates } = mapHeaders(EXPORT_COLUMNS.map((c) => c.header));
    expect(duplicates).toEqual([]);
    expect(unknown).toEqual(["Mã", "Ngày hết hạn", "Số ngày còn lại", "Trạng thái hạn"]);
    expect(Object.keys(map)).toHaveLength(15);
  });

  it("writes Vietnamese labels, dd/mm/yyyy dates and guarded text in CSV", () => {
    const csv = recordsToCsv(ROWS);
    expect(csv.startsWith("\uFEFFMã,Họ tên,Email,Team,Khóa học")).toBe(true);
    expect(csv).toContain("29/02/2024");
    expect(csv).toContain("Hoàn thành");
    expect(csv).toContain("Đã hoàn tiền");
    expect(csv).toContain("'=cần kiểm tra");
    expect(csv).toContain("1%");
    expect(csv).toContain("Có");
  });

  it("quotes a multi-line note as one CSV field", () => {
    expect(recordsToCsv(ROWS)).toContain(`"${NOTE}"`);
  });

  it("writes a header-only file when there are no records", () => {
    expect(recordsToCsv([]).split("\r\n").filter(Boolean)).toHaveLength(1);
    const table = readImportTable(recordsToXlsx([]));
    expect(table.ok && table.value.rows).toEqual([]);
  });
});
