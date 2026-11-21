import type { LearningRow } from "@/features/learning/queries";
import type { RecordRow } from "@/features/records/queries";

/** What a learning item is called where one name is needed: its exam, else its course. */
export const learningItemTitle = (item: { targetCertificateName: string | null; courseName: string | null }): string =>
  item.targetCertificateName ?? item.courseName ?? "Self-study";

/**
 * The open learning items in the shape the dashboard metrics already count as "the journey" (in progress,
 * not started, planned exams), so those functions keep one input. Finished items are left out: a finished
 * item is history, and only a certificate (training_records) is ever counted as held (decision #72).
 * shortcut: adapter instead of learning-aware metrics; split them if the two lists need different numbers.
 */
export function learningAsJourneyRecords(items: LearningRow[]): RecordRow[] {
  return items
    .filter((item) => item.status !== "done")
    .map((item) => ({
      id: item.id,
      memberId: item.memberId,
      memberCode: item.memberCode,
      memberName: item.memberName,
      memberEmail: item.memberEmail,
      teamId: item.teamId,
      teamName: item.teamName,
      // An exam target counts like the old exam attempt; a course-only item like a course completion in progress.
      certificateId: item.targetCertificateId ?? item.courseId ?? item.id,
      certificateKind: item.targetCertificateId ? "exam" : "completion",
      certificateName: learningItemTitle(item),
      courseId: item.courseId,
      courseName: item.courseName,
      certTypeName: null,
      providerName: item.providerName,
      validityMonths: null,
      cost: null,
      costCurrency: null,
      estHours: null,
      status: item.status,
      progress: item.progress,
      plannedExamDate: item.targetCertificateId ? item.plannedDate : null,
      issuedDate: null,
      certificateUrl: null,
      hasEvidence: false,
      viaCompany: false,
      refundStatus: "n_a",
      notes: item.notes,
      expiryDate: null,
      daysToExpiry: null,
      expiryStatus: "N/A",
      approval: null,
      approvalNote: null,
    }));
}
