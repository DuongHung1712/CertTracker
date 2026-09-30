import { describe, expect, it } from "vitest";
import { recordRuleIssues, recordSchema } from "@/features/records/schema";

const base = {
  memberId: "00000000-0000-0000-0000-000000000000",
  courseId: "00000000-0000-0000-0000-000000000000",
  status: "in_progress",
  progress: 40,
  plannedExamDate: "",
  issuedDate: "",
  certificateUrl: "",
  notes: "",
};

describe("recordSchema", () => {
  it("parses typed dd/mm/yyyy dates into ISO and blank fields into null", () => {
    const result = recordSchema.safeParse({ ...base, plannedExamDate: "15/03/2027" });
    expect(result.success).toBe(true);
    expect(result.data?.plannedExamDate).toBe("2027-03-15");
    expect(result.data?.issuedDate).toBeNull();
    expect(result.data?.notes).toBeNull();
  });

  it("is idempotent: its own output parses to the same value (the action re-validates)", () => {
    const first = recordSchema.parse({ ...base, plannedExamDate: "15/03/2027", notes: "  ôn thi  " });
    expect(recordSchema.parse(first)).toEqual(first);
  });

  it("treats whitespace-only text as empty", () => {
    expect(recordSchema.parse({ ...base, notes: "   " }).notes).toBeNull();
  });

  it("leaves company fields undefined when the form does not send them", () => {
    const parsed = recordSchema.parse(base);
    expect(parsed.viaCompany).toBeUndefined();
    expect(parsed.refundStatus).toBeUndefined();
  });

  it("rejects an impossible date and a non-http link", () => {
    expect(recordSchema.safeParse({ ...base, plannedExamDate: "31/02/2027" }).success).toBe(false);
    expect(recordSchema.safeParse({ ...base, certificateUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(recordSchema.safeParse({ ...base, certificateUrl: "https://credly.com/badges/1" }).success).toBe(true);
  });

  it("rejects progress outside 0..100 and non-integers", () => {
    expect(recordSchema.safeParse({ ...base, progress: 101 }).success).toBe(false);
    expect(recordSchema.safeParse({ ...base, progress: -1 }).success).toBe(false);
    expect(recordSchema.safeParse({ ...base, progress: 40.5 }).success).toBe(false);
  });

  it("requires an issue date and 100% for a finished record", () => {
    const result = recordSchema.safeParse({ ...base, status: "done", progress: 100 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["issuedDate"]);
  });
});

describe("recordRuleIssues", () => {
  const today = "2026-09-30";

  it("mirrors the three database CHECK constraints", () => {
    expect(recordRuleIssues({ status: "done", progress: 90, issuedDate: "2026-01-01" }, today)).toHaveLength(1);
    expect(recordRuleIssues({ status: "done", progress: 100, issuedDate: null }, today)).toHaveLength(1);
    expect(recordRuleIssues({ status: "not_started", progress: 5, issuedDate: null }, today)).toHaveLength(1);
    expect(recordRuleIssues({ status: "in_progress", progress: 100, issuedDate: null }, today)).toHaveLength(1);
    expect(recordRuleIssues({ status: "in_progress", progress: 99, issuedDate: null }, today)).toHaveLength(0);
    expect(recordRuleIssues({ status: "in_progress", progress: 0, issuedDate: null }, today)).toHaveLength(0);
  });

  it("allows an issue date of today and rejects tomorrow", () => {
    expect(recordRuleIssues({ status: "done", progress: 100, issuedDate: "2026-09-30" }, today)).toHaveLength(0);
    expect(recordRuleIssues({ status: "done", progress: 100, issuedDate: "2026-10-01" }, today)).toHaveLength(1);
  });
});
