import { CERTIFICATE_KIND_NOUN, certificateSheetTitle, type CertificateKind } from "@/features/certificates/schema";

type WithKind = { certificateKind: CertificateKind };

export type ApprovalState = "waiting" | "approved" | "returned";

/** A member can delete their own training record if it is a draft (not started, in progress) or was returned by a manager/admin. */
export function isRecordDeletableByMember(record: {
  status: string;
  approval?: ApprovalState | null;
}): boolean {
  return record.status === "not_started" || record.status === "in_progress" || record.approval === "returned";
}

/**
 * The one place that says what counts (same rule as SQL `counted_approval`): a Completed item counts once a
 * manager or admin approved it, until a later approved renewal of the same certificate replaces it.
 */
export const isApprovedDone = (row: { status: string; approval: ApprovalState | null; renewed?: boolean }): boolean =>
  row.status === "done" && row.approval === "approved" && !row.renewed;

/** Every item that is not Completed-but-unapproved or renewed: the rows a count may look at. */
export const isCounted = (row: { status: string; approval: ApprovalState | null; renewed?: boolean }): boolean =>
  row.status !== "done" || isApprovedDone(row);

/** A waiting item the viewer can act on: a manager never reviews their own (pass null for an admin, who may). */
export const isReviewable = (
  row: { status: string; approval: ApprovalState | null; memberId: string },
  ownMemberId: string | null,
): boolean => row.status === "done" && row.approval === "waiting" && row.memberId !== ownMemberId;

export const KIND_FILTERS = ["all", "exam", "completion"] as const;
export type KindFilter = (typeof KIND_FILTERS)[number];

export const KIND_FILTER_LABEL: Record<KindFilter, string> = {
  all: "All",
  exam: "Exam certificates",
  completion: "Course completions",
};

export const isExam = (row: WithKind): boolean => row.certificateKind === "exam";
export const isCompletion = (row: WithKind): boolean => row.certificateKind === "completion";

export function filterByKind<T extends WithKind>(rows: T[], filter: KindFilter): T[] {
  return filter === "all" ? rows : rows.filter((row) => row.certificateKind === filter);
}

export function kindCounts(rows: WithKind[]): Record<KindFilter, number> {
  return { all: rows.length, exam: rows.filter(isExam).length, completion: rows.filter(isCompletion).length };
}

/** Label only: the column is `planned_exam_date` for both kinds. */
export const plannedDateLabel = (kind: CertificateKind): string =>
  kind === "exam" ? "Planned exam date" : "Planned finish date";

/** A list column can only name one kind when the list is filtered to it. */
export const plannedDateHeader = (filter: KindFilter): string =>
  filter === "all" ? "Planned date" : plannedDateLabel(filter);

const NEUTRAL_ADD_TITLE = "Add certificate or course completion";

/** Neutral until a certificate is chosen; after that a completion is never called a "certificate". */
export const recordSheetTitle = (editing: boolean, kind: CertificateKind | undefined): string =>
  kind ? certificateSheetTitle(editing, kind) : NEUTRAL_ADD_TITLE;

export const recordSavedMessage = (editing: boolean, kind: CertificateKind | undefined): string =>
  `${editing ? "Saved" : "Added"} ${CERTIFICATE_KIND_NOUN[kind ?? "exam"]}`;

/** For an exam the date on the record is the day it was passed; a completion has an issue date. */
export const issuedDateLabel = (kind: CertificateKind): string => (kind === "exam" ? "Date passed" : "Issue date");

export const issuedDateHint = (kind: CertificateKind): string =>
  kind === "exam"
    ? "The day you passed the exam. The expiry date is worked out from its validity period."
    : "The day it was issued. A course completion does not expire.";

/** The "What are you adding?" choice at the top of the record sheet. */
export const ADD_KIND_CHOICES: { kind: CertificateKind; label: string; hint: string }[] = [
  {
    kind: "exam",
    label: "Exam certificate",
    hint: "Official certifications validated by an exam (AWS, Azure, CKA, PMP...)",
  },
  {
    kind: "completion",
    label: "Course completion",
    hint: "Courses and training programs with a completion certificate (Coursera, Udemy, internal...)",
  },
];

/**
 * How the member got there, for the second line of a learning item: an exam names the course that prepared for
 * it, or "Self-study" when there is none or the course only carries the exam's cost (an import names it after the
 * exam); when not started yet with no course, returns null to avoid repeating the provider already shown on the card;
 * a course completion shows its provider, since its course is the completion itself.
 */
export function learningPath(row: {
  certificateKind: CertificateKind;
  status: "not_started" | "in_progress" | "done";
  certificateName: string;
  courseName: string | null;
  providerName: string | null;
}): string | null {
  if (row.status === "not_started") {
    // When not started, do not return providerName to avoid duplicate provider display
    if (row.certificateKind === "completion") return null;
    const course = row.courseName?.trim();
    if (!course || course.localeCompare(row.certificateName.trim(), undefined, { sensitivity: "base" }) === 0) {
      return null;
    }
    return `Prepared via ${course}`;
  }
  if (row.certificateKind === "completion") return row.providerName;
  const course = row.courseName?.trim();
  if (!course || course.localeCompare(row.certificateName.trim(), undefined, { sensitivity: "base" }) === 0) {
    return "Self-study";
  }
  return `Prepared via ${course}`;
}
