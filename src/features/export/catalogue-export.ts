// Server-only in practice: it pulls in the xlsx writer; call it from route handlers, not client components.
import * as XLSX from "xlsx";
import type { CertificateRow } from "@/features/certificates/queries";
import type { CertificateKind } from "@/features/certificates/schema";
import type { listCourses } from "@/features/courses/queries";
import { toCsv } from "@/features/export/csv";

type CourseRow = Awaited<ReturnType<typeof listCourses>>[number];
type Cell = string | number | null;

const KIND_LABEL: Record<CertificateKind, string> = { exam: "Exam certificate", completion: "Course certificate" };

export const CERTIFICATE_HEADERS = [
  "Name",
  "Kind",
  "Certificate type",
  "Provider",
  "Level",
  "Validity (months)",
  "Link",
  "Granting course",
  "Prepared by",
];

export const COURSE_HEADERS = [
  "Name",
  "Provider",
  "Prepares for",
  "Grants",
  "Cost",
  "Currency",
  "Duration (hours)",
  "Refundable",
  "Refund conditions",
  "Link",
];

/** One row per certificate; only exams carry a validity, and "Prepared by" lists the courses that prepare for it. */
export function certificateExportRows(certificates: CertificateRow[], courses: CourseRow[]): Cell[][] {
  return certificates.map((c) => [
    c.name,
    KIND_LABEL[c.kind],
    c.certTypeName,
    c.providerName,
    c.level,
    c.kind === "exam" ? c.validityMonths : null,
    c.url,
    c.courseName,
    courses.filter((course) => course.preparesForId === c.id).map((course) => course.name).join("; ") || null,
  ]);
}

export function courseExportRows(courses: CourseRow[]): Cell[][] {
  return courses.map((c) => [
    c.name,
    c.providerName,
    c.preparesForName,
    c.grantsCertificateName,
    c.cost,
    c.costCurrency,
    c.estHours,
    c.refundable ? "Yes" : "No",
    c.refundable ? c.refundConditions : null,
    c.url,
  ]);
}

/** CSV holds the Certificates list only: one file cannot honestly carry two different column sets. */
export function catalogueToCsv(certificates: CertificateRow[], courses: CourseRow[]): string {
  return toCsv(CERTIFICATE_HEADERS, certificateExportRows(certificates, courses));
}

export function catalogueToXlsx(certificates: CertificateRow[], courses: CourseRow[]): Uint8Array<ArrayBuffer> {
  const book = XLSX.utils.book_new();
  const sheet = (headers: string[], rows: Cell[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h) => ({ wch: h === "Name" ? 32 : 18 }));
    return ws;
  };
  XLSX.utils.book_append_sheet(book, sheet(CERTIFICATE_HEADERS, certificateExportRows(certificates, courses)), "Certificates");
  XLSX.utils.book_append_sheet(book, sheet(COURSE_HEADERS, courseExportRows(courses)), "Courses");
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
