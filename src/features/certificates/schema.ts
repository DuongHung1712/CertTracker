import { z } from "zod";
import { emptyToNull } from "@/features/courses/schema";

export const CERTIFICATE_KINDS = ["exam", "completion"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export const CERTIFICATE_KIND_LABEL: Record<CertificateKind, string> = { exam: "Exam", completion: "Course completion" };

/** What to call one row in a sentence: a completion is never a "certificate" in the UI. */
export const CERTIFICATE_KIND_NOUN: Record<CertificateKind, string> = { exam: "certificate", completion: "course completion" };

/** Fields without the cross-field rule, so a caller can `.extend()` them (e.g. with an id) and re-apply the rule. */
export const certificateFields = z.object({
  kind: z.enum(CERTIFICATE_KINDS, "Choose a kind"),
  name: z.string().trim().min(1, "Enter the certificate name"),
  // z.guid(), not .uuid(): see `idSchema` in the courses schema.
  certTypeId: z.guid("Choose a certificate type"),
  providerId: z.guid("Choose a provider"),
  level: z.string().trim().optional().default(""),
  validityMonths: emptyToNull(z.coerce.number().int().positive("Validity must be greater than 0")),
  url: emptyToNull(z.string().trim().url("Enter a valid link")),
  /** The course that grants a completion; an exam never has one. */
  courseId: emptyToNull(z.guid("Invalid data")),
});

type KindAndCourse = { kind: CertificateKind; courseId: string | null };

function requireGrantingCourse(value: KindAndCourse, context: z.RefinementCtx): void {
  if (value.kind === "completion" && value.courseId === null) {
    context.addIssue({ code: "custom", path: ["courseId"], message: "Choose the course that grants this completion" });
  }
}

const dropCourseForExam = <T extends KindAndCourse>(value: T): T => (value.kind === "exam" ? { ...value, courseId: null } : value);

export const certificateSchema = certificateFields.superRefine(requireGrantingCourse).transform(dropCourseForExam);
export const certificateWithIdSchema = certificateFields
  .extend({ id: z.guid("Invalid data") })
  .superRefine(requireGrantingCourse)
  .transform(dropCourseForExam);
export type CertificateInput = z.infer<typeof certificateSchema>;
