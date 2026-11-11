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
