import { CERTIFICATE_KIND_NOUN, certificateSheetTitle, type CertificateKind } from "@/features/certificates/schema";

type WithKind = { certificateKind: CertificateKind };

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
