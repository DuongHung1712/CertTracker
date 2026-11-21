import { describe, expect, it } from "vitest";
import { learningSchema } from "@/features/learning/schema";
import { todayVn } from "@/lib/dates";

const M = "5eed0000-0000-0000-0000-00000000b001";
const C = "5eed0000-0000-0000-0000-00000000c001";
const E = "5eed0000-0000-0000-0000-00000000e001";
const base = { memberId: M, courseId: C, targetCertificateId: "", status: "in_progress", progress: 30, plannedDate: "", finishedDate: "", notes: "" };

const errorAt = (input: Record<string, unknown>, path: string) => {
  const result = learningSchema.safeParse(input);
  return result.success ? undefined : result.error.issues.find((issue) => issue.path[0] === path)?.message;
};

describe("learningSchema", () => {
  it("accepts a course, an exam, or both", () => {
    expect(learningSchema.safeParse(base).success).toBe(true);
    expect(learningSchema.safeParse({ ...base, courseId: "", targetCertificateId: E }).success).toBe(true);
    expect(learningSchema.safeParse({ ...base, targetCertificateId: E }).success).toBe(true);
  });

  it("needs a course or an exam", () => {
    expect(errorAt({ ...base, courseId: "" }, "courseId")).toBe("Choose a course or an exam");
  });

  it("needs a finished date that is not in the future when completed", () => {
    expect(errorAt({ ...base, status: "done", progress: 100 }, "finishedDate")).toBe("Enter the date you finished");
    const [y, m, d] = todayVn().split("-").map(Number);
    const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1));
    const text = `${String(tomorrow.getUTCDate()).padStart(2, "0")}/${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}/${tomorrow.getUTCFullYear()}`;
    expect(errorAt({ ...base, status: "done", progress: 100, finishedDate: text }, "finishedDate")).toBe("The date cannot be in the future");
  });

  it("turns blanks into null and dates into ISO", () => {
    const parsed = learningSchema.parse({ ...base, plannedDate: "15/12/2026" });
    expect(parsed).toMatchObject({ targetCertificateId: null, plannedDate: "2026-12-15", finishedDate: null, notes: null });
  });
});
