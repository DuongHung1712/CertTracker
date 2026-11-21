import { describe, expect, it } from "vitest";
import { calculateMemberKpis } from "@/features/dashboard/member-metrics";
import { getPlannedExams } from "@/features/dashboard/manager-metrics";
import { learningAsJourneyRecords } from "@/features/learning/journey";
import type { LearningRow } from "@/features/learning/queries";
import { todayVn } from "@/lib/dates";

const NOW = new Date("2026-11-21T03:00:00Z");
const inDays = (days: number): string => {
  const [y, m, d] = todayVn(NOW).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};

const item = (partial: Partial<LearningRow>): LearningRow => ({
  id: "li-1", memberId: "m1", memberCode: "M001", memberName: "Jane", memberEmail: "an@x.vn", teamId: "t1", teamName: "Team Cloud",
  courseId: null, courseName: null, providerName: null, courseCatalogueStatus: null,
  targetCertificateId: "e1", targetCertificateName: "HSK 3", status: "in_progress", progress: 40,
  plannedDate: inDays(10), finishedDate: null, notes: null, isSelfStudy: true, ...partial,
});

describe("learningAsJourneyRecords", () => {
  it("leaves out finished items: only the open journey is counted", () => {
    expect(learningAsJourneyRecords([item({ status: "done", finishedDate: inDays(-1) }), item({ id: "li-2" })]).map((r) => r.id)).toEqual(["li-2"]);
  });

  it("metrics never count learning rows as certificates", () => {
    const kpis = calculateMemberKpis(learningAsJourneyRecords([item({}), item({ id: "li-2", status: "not_started", progress: 0 })]));
    expect(kpis).toMatchObject({ inProgressCount: 1, notStartedCount: 1 });
    expect(kpis.validCount + kpis.expiringCount + kpis.expiredCount).toBe(0);
  });

  it("puts an exam target with a planned date into Planned exams, and not a course-only item", () => {
    const rows = learningAsJourneyRecords([item({}), item({ id: "li-c", targetCertificateId: null, targetCertificateName: null, courseId: "k1", courseName: "Udemy course" })]);
    expect(getPlannedExams(rows, 60, NOW).map((exam) => [exam.recordId, exam.certificateName])).toEqual([["li-1", "HSK 3"]]);
  });
});
