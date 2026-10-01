// Server-only in practice: it pulls in the xlsx writer; call it from route handlers, not client components.
import * as XLSX from "xlsx";
import { RECORD_STATUS_LABEL } from "@/components/status/labels";
import { expiryMeta, toExpiryStatus } from "@/components/status/expiry";
import { toCsv } from "@/features/export/csv";
import { isoToExcelSerial } from "@/features/import/clean";
import type { RecordRow } from "@/features/records/queries";
import { REFUND_STATUS_LABEL } from "@/features/records/schema";
import { formatDate } from "@/lib/format";

type ColumnKind = "text" | "number" | "date" | "percent";
type Value = string | number | null;

type ExportColumn = {
  header: string;
  kind: ColumnKind;
  /** `date` columns return an ISO date, `percent` columns a 0..100 number. */
  value: (row: RecordRow) => Value;
  width?: number;
};

/**
 * Column order and headers are the export contract: the import accepts an exported file unchanged (decision #26).
 * Import-relevant headers resolve through HEADER_ALIASES; "Mã", "Ngày hết hạn", "Số ngày còn lại" and
 * "Trạng thái hạn" are display-only and are reported as unknown (ignored) columns on re-import.
 */
export const EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Mã", kind: "text", value: (r) => r.memberCode },
  { header: "Họ tên", kind: "text", value: (r) => r.memberName, width: 28 },
  { header: "Email", kind: "text", value: (r) => r.memberEmail, width: 28 },
  { header: "Team", kind: "text", value: (r) => r.teamName },
  { header: "Khóa học", kind: "text", value: (r) => r.courseName, width: 28 },
  { header: "Nhà cung cấp", kind: "text", value: (r) => r.providerName },
  { header: "Loại chứng chỉ", kind: "text", value: (r) => r.certTypeName },
  { header: "Thời hạn (tháng)", kind: "number", value: (r) => r.validityMonths },
  { header: "Trạng thái", kind: "text", value: (r) => RECORD_STATUS_LABEL[r.status] },
  { header: "Tiến độ (%)", kind: "percent", value: (r) => r.progress },
  { header: "Ngày thi dự kiến", kind: "date", value: (r) => r.plannedExamDate, width: 14 },
  { header: "Ngày cấp", kind: "date", value: (r) => r.issuedDate, width: 14 },
  { header: "Ngày hết hạn", kind: "date", value: (r) => r.expiryDate, width: 14 },
  { header: "Số ngày còn lại", kind: "number", value: (r) => r.daysToExpiry },
  { header: "Trạng thái hạn", kind: "text", value: (r) => expiryMeta(toExpiryStatus(r.expiryStatus)).label },
  { header: "Link chứng chỉ", kind: "text", value: (r) => r.certificateUrl },
  { header: "Qua công ty", kind: "text", value: (r) => (r.viaCompany ? "Có" : "Không") },
  { header: "Hoàn tiền", kind: "text", value: (r) => REFUND_STATUS_LABEL[r.refundStatus] },
  { header: "Ghi chú", kind: "text", value: (r) => r.notes, width: 40 },
];

const HEADERS = EXPORT_COLUMNS.map((column) => column.header);

export function recordsToCsv(rows: RecordRow[]): string {
  const body = rows.map((row) =>
    EXPORT_COLUMNS.map((column): Value => {
      const value = column.value(row);
      if (value === null) return null;
      if (column.kind === "date") return formatDate(String(value));
      if (column.kind === "percent") return `${value}%`;
      return value;
    }),
  );
  return toCsv(HEADERS, body);
}

/** Real date serials and fractions with number formats, so Excel shows dd/mm/yyyy and percentages and the file re-imports as-is. */
export function recordsToXlsx(rows: RecordRow[]): Uint8Array<ArrayBuffer> {
  const body = rows.map((row) =>
    EXPORT_COLUMNS.map((column): Value => {
      const value = column.value(row);
      if (value === null) return null;
      if (column.kind === "date") return isoToExcelSerial(String(value));
      if (column.kind === "percent") return Number(value) / 100;
      return value;
    }),
  );
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...body]);
  EXPORT_COLUMNS.forEach((column, c) => {
    const format = column.kind === "date" ? "dd/mm/yyyy" : column.kind === "percent" ? "0%" : null;
    if (!format) return;
    for (let r = 1; r <= rows.length; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (cell) cell.z = format;
    }
  });
  sheet["!cols"] = EXPORT_COLUMNS.map((column) => ({ wch: column.width ?? 16 }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Chứng chỉ");
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
