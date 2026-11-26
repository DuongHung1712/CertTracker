import { z } from "zod";
import { courseFields, dropConditionsUnlessRefundable, emptyToNull, requireCostWithCurrency } from "@/features/courses/schema";

export const CERTIFICATE_KINDS = ["exam", "completion"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export const CERTIFICATE_KIND_LABEL: Record<CertificateKind, string> = { exam: "Exam", completion: "Course certificate" };

/** What to call one row in a sentence: an exam is a "certificate", a completion a "course certificate". */
export const CERTIFICATE_KIND_NOUN: Record<CertificateKind, string> = { exam: "certificate", completion: "course certificate" };

/** Course names for the "Prepared by" cell: the first few, then "+N more". */
export function formatPreparedBy(names: string[], max = 2): string {
  if (names.length === 0) return "—";
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max} more` : shown;
}

/** Short explanation under the Kind select. */
export const CERTIFICATE_KIND_HELP =
  "Exam: earned by passing an exam, has a validity. Course certificate: earned by finishing a course, granted by one course.";

/** One add button serves both kinds on the Catalogue tab. */
export const CERTIFICATE_ADD_NEUTRAL_LABEL = "Add exam or course certificate";

export const certificateSheetTitle = (editing: boolean, kind: CertificateKind): string =>
  `${editing ? "Edit" : "Add"} ${CERTIFICATE_KIND_NOUN[kind]}`;

export const certificateDeleteHint = (kind: CertificateKind): string =>
  `A ${CERTIFICATE_KIND_NOUN[kind]} that members hold cannot be deleted. This cannot be undone.`;

/** Fields without the cross-field rule, so a caller can `.extend()` them (e.g. with an id) and re-apply the rule. */
export const certificateFields = z.object({
  kind: z.enum(CERTIFICATE_KINDS, "Choose a kind"),
  name: z.string().trim().min(1, "Enter the name"),
  // z.guid(), not .uuid(): see `idSchema` in the courses schema.
  certTypeId: z.guid("Type is required"),
  providerId: z.guid("Provider is required"),
  level: z.string().trim().optional().default(""),
  validityMonths: emptyToNull(z.coerce.number().int().positive("Validity must be greater than 0")),
  url: emptyToNull(z.string().trim().url("Enter a valid link")),
  /** The course that grants a completion; an exam never has one. */
  courseId: emptyToNull(z.guid("Invalid data")),
});

type KindAndCourse = { kind: CertificateKind; courseId: string | null };

function requireGrantingCourse(value: KindAndCourse, context: z.RefinementCtx): void {
  if (value.kind === "completion" && value.courseId === null) {
    context.addIssue({ code: "custom", path: ["courseId"], message: "Choose the course that grants this certificate" });
  }
}

type KindFields = KindAndCourse & { validityMonths: number | null };

/** An exam never has a granting course; a completion never expires, so its validity is never saved. */
const normaliseByKind = <T extends KindFields>(value: T): T =>
  value.kind === "exam" ? { ...value, courseId: null } : { ...value, validityMonths: null };

export const certificateSchema = certificateFields.superRefine(requireGrantingCourse).transform(normaliseByKind);
export const certificateWithIdSchema = certificateFields
  .extend({ id: z.guid("Invalid data") })
  .superRefine(requireGrantingCourse)
  .transform(normaliseByKind);
export type CertificateInput = z.infer<typeof certificateSchema>;

/** Shared by the certificate actions and the one-step course action, so both word a clash the same way. */
export const certificateDuplicateMessage = (kind: CertificateKind, name: string): string =>
  `A ${CERTIFICATE_KIND_NOUN[kind]} named "${name}" already exists for this provider, or this course already grants a course certificate.`;

/**
 * The course form plus the optional completion it grants. The completion takes the course's name (unless one is given) and provider,
 * and its link unless one is given; it never expires, so no validity is asked.
 */
export const courseWithCompletionSchema = courseFields
  .extend({
    grantsCompletion: z.boolean().default(false),
    completionCertTypeId: z.string().default(""),
    completionUrl: emptyToNull(z.string().trim().url("Enter a valid link")),
    /** Empty means the course name. */
    completionName: emptyToNull(certificateFields.shape.name),
  })
  .superRefine((value, context) => {
    requireCostWithCurrency(value, context);
    if (value.grantsCompletion && !z.guid().safeParse(value.completionCertTypeId).success) {
      context.addIssue({ code: "custom", path: ["completionCertTypeId"], message: "Type is required" });
    }
  })
  .transform((value) => ({
    ...dropConditionsUnlessRefundable(value),
    completionCertTypeId: value.grantsCompletion ? value.completionCertTypeId : "",
    completionUrl: value.grantsCompletion ? value.completionUrl : null,
    completionName: value.grantsCompletion ? value.completionName : null,
  }));
export type CourseWithCompletionInput = z.infer<typeof courseWithCompletionSchema>;

export const proposeCertificateSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the certificate or course name").max(200, "Name can have at most 200 characters"),
    kind: z.enum(CERTIFICATE_KINDS, "Choose a kind"),
    providerId: z.guid("Choose a provider from the list").nullable().optional(),
    proposedProvider: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null)),
      z.string().trim().max(100, "Provider can have at most 100 characters").nullable().optional(),
    ),
    url: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null)),
      z.string().trim().url("Enter a valid link").nullable().optional(),
    ),
    reason: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null)),
      z.string().trim().max(1000, "Reason can have at most 1000 characters").nullable().optional(),
    ),
  })
  .refine(
    (data) => !!data.providerId || !!(data.proposedProvider && data.proposedProvider.trim().length > 0),
    {
      path: ["proposedProvider"],
      message: "Choose an existing provider or enter a provider name",
    },
  );
export type ProposeCertificateInput = z.infer<typeof proposeCertificateSchema>;
export type ProposeCertificateFormInput = z.input<typeof proposeCertificateSchema>;
