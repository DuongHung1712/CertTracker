import { describe, expect, it } from "vitest";
import type { CertificateRow } from "@/features/certificates/queries";
import * as XLSX from "xlsx";
import { catalogueToCsv, catalogueToXlsx, certificateExportRows, courseExportRows } from "@/features/export/catalogue-export";

const exam: CertificateRow = {
  id: "e1", name: "AWS SAA", kind: "exam", certTypeId: "t", certTypeName: "Cloud", providerId: "p", providerName: "AWS",
  level: "Associate", validityMonths: 36, url: "https://x.test", courseId: null, courseName: null, catalogueStatus: "approved",
};
const completion: CertificateRow = { ...exam, id: "c1", name: "Intro done", kind: "completion", validityMonths: 12, courseId: "k1", courseName: "Intro" };
const course = (over: Partial<Parameters<typeof courseExportRows>[0][number]>) => ({
  id: "k1", name: "Intro", providerId: "p", providerName: "AWS", preparesForId: null, preparesForName: null,
  grantsCertificateName: null, refundable: false, cost: null, costCurrency: null, estHours: null, url: null, refundConditions: null, catalogueStatus: "approved" as const,
  ...over,
});

describe("certificateExportRows", () => {
  it("labels kinds, keeps validity for exams only and joins the preparing courses", () => {
    const courses = [course({ id: "a", name: "Prep A", preparesForId: "e1" }), course({ id: "b", name: "Prep B", preparesForId: "e1" })];
    const [examRow, completionRow] = certificateExportRows([exam, completion], courses);
    expect(examRow).toEqual(["AWS SAA", "Exam certificate", "Cloud", "AWS", "Associate", 36, "https://x.test", null, "Prep A; Prep B"]);
    expect(completionRow[1]).toBe("Course certificate");
    expect(completionRow[5]).toBeNull();
    expect(completionRow[7]).toBe("Intro");
  });
});

describe("courseExportRows", () => {
  it("drops refund conditions of a non-refundable course", () => {
    const [row] = courseExportRows([course({ refundable: false, refundConditions: "stale", cost: 10, costCurrency: "USD" })]);
    expect(row[7]).toBe("No");
    expect(row[8]).toBeNull();
  });
});

describe("catalogueToCsv", () => {
  it("starts with a BOM and English sentence-case headers", () => {
    const csv = catalogueToCsv([exam], []);
    expect(csv.startsWith("﻿Name,Kind,Certificate type,Provider,Level,Validity (months),Link,Granting course,Prepared by")).toBe(true);
  });
});

describe("formula injection", () => {
  const evil = { ...exam, name: "=1+1" };

  it("neutralises a formula-like name in CSV", () => {
    expect(catalogueToCsv([evil], [])).toContain("\r\n'=1+1,");
  });

  it("stores it as a plain string cell in xlsx, not a formula", () => {
    const book = XLSX.read(catalogueToXlsx([evil], []), { type: "array" });
    const cell = book.Sheets.Certificates.A2;
    expect(cell.t).toBe("s");
    expect(cell.v).toBe("=1+1");
    expect(cell.f).toBeUndefined();
  });
});
