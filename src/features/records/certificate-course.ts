import type { ComboboxOption } from "@/components/entity-combobox";
import type { CertificateKind } from "@/features/certificates/schema";

export type CertificateChoice = ComboboxOption & {
  kind: CertificateKind;
  /** The course that grants a completion; null for an exam. */
  grantingCourse: { id: string; name: string } | null;
};

export type StudyCourse = { id: string; name: string; preparesForId: string };

export function studyCoursesFor(courses: StudyCourse[], certificateId: string): StudyCourse[] {
  return courses.filter((course) => course.preparesForId === certificateId);
}

export type SavedCourse = { id: string; name: string; certificateId: string };
export type CourseChoice = { id: string; label: string };

/**
 * The "Course studied" options for an exam: the courses that prepare for it, plus the record's own saved course when an admin
 * has since unlinked it, so the form shows what is stored instead of pretending the record is self-study.
 */
export function courseChoicesFor(courses: StudyCourse[], certificateId: string, saved: SavedCourse | null): CourseChoice[] {
  const choices = studyCoursesFor(courses, certificateId).map((course) => ({ id: course.id, label: course.name }));
  const unlinked = saved && saved.certificateId === certificateId && !choices.some((choice) => choice.id === saved.id);
  return unlinked ? [...choices, { id: saved.id, label: `${saved.name} (no longer linked to this certificate)` }] : choices;
}

/** The course value after the certificate changes: a completion has its granting course; an exam keeps the course only if it prepares for it. */
export function courseAfterCertificateChange(
  certificate: CertificateChoice | undefined,
  courses: StudyCourse[],
  currentCourseId: string,
): string {
  if (!certificate) return "";
  if (certificate.kind === "completion") return certificate.grantingCourse?.id ?? "";
  return studyCoursesFor(courses, certificate.id).some((course) => course.id === currentCourseId) ? currentCourseId : "";
}
