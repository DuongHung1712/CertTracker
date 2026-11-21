import { z } from "zod";
import type { RecordStatus } from "@/components/status/labels";
import { toIsoDate, todayVn } from "@/lib/dates";

export const RECORD_STATUSES = ["not_started", "in_progress", "done"] as const;
export const REFUND_STATUSES = ["n_a", "pending", "approved", "rejected", "paid"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  n_a: "Not applicable",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Refunded",
};

/** `z.guid()`, not `.uuid()`: seed ids are not RFC 4122 (see src/features/members/schema.ts). */
export const idSchema = z.object({ id: z.guid("Invalid data") });

/** A manager's verdict on a Completed item; returning it needs a reason the member can act on. */
export const reviewSchema = z
  .object({
    id: z.guid("Invalid data"),
    decision: z.enum(["approve", "return"]),
    note: z.string().trim().max(2000, "The note can have at most 2000 characters").optional(),
  })
  .refine((value) => value.decision === "approve" || !!value.note, { path: ["note"], message: "Write what the member should fix." });

/** Bulk actions: 1 to MAX_BULK_DELETE distinct ids, so one request cannot become an unbounded delete. */
export const MAX_BULK_DELETE = 100;
export const recordIdsSchema = z.object({
  ids: z
    .array(z.guid("Invalid data"))
    .min(1, "Invalid data")
    .max(MAX_BULK_DELETE, "Invalid data")
    .refine((ids) => new Set(ids).size === ids.length, "Invalid data"),
});

export const blankToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === undefined || (typeof value === "string" && value.trim() === "") ? null : value),
    schema.nullable(),
  );

export const optionalDate = (message: string) =>
  blankToNull(
    z
      .string()
      .refine((value) => toIsoDate(value) !== null, message)
      .transform((value) => toIsoDate(value) as string),
  );

/** The database CHECK constraints plus the "not in the future" rule, as data — reused by the Excel import. */
export function recordRuleIssues(
  value: { status: RecordStatus; progress: number; issuedDate: string | null },
  today: string,
): { path: "progress" | "issuedDate"; message: string }[] {
  const issues: { path: "progress" | "issuedDate"; message: string }[] = [];
  if (value.status === "done" && value.progress !== 100) {
    issues.push({ path: "progress", message: "A completed course must have progress 100%" });
  }
  if (value.status === "done" && !value.issuedDate) {
    issues.push({ path: "issuedDate", message: "A completed item needs a date" });
  }
  if (value.status === "not_started" && value.progress !== 0) {
    issues.push({ path: "progress", message: "A course that has not started must have progress 0%" });
  }
  if (value.status === "in_progress" && value.progress > 99) {
    issues.push({ path: "progress", message: "Set the status to Completed when progress is 100%" });
  }
  // ISO dates compare correctly as strings.
  if (value.issuedDate && value.issuedDate > today) {
    issues.push({ path: "issuedDate", message: "The date cannot be in the future" });
  }
  return issues;
}

export const recordSchema = z
  .object({
    memberId: z.guid("Choose a member"),
    certificateId: z.guid("Choose a certificate"),
    /** The course studied: optional for an exam; for a completion the database sets the granting course. */
    courseId: blankToNull(z.guid("Invalid data")),
    status: z.enum(RECORD_STATUSES, "Choose a status"),
    progress: z.coerce
      .number("Progress must be a number")
      .int("Progress must be a whole number")
      .min(0, "Progress must be between 0 and 100")
      .max(100, "Progress must be between 0 and 100"),
    plannedExamDate: optionalDate("Enter a valid planned exam date (dd/mm/yyyy)"),
    issuedDate: optionalDate("Enter a valid date (dd/mm/yyyy)"),
    certificateUrl: blankToNull(
      z
        .string()
        .trim()
        .url("Enter a valid link")
        .refine((value) => /^https?:\/\//i.test(value), "The link must start with http:// or https://"),
    ),
    // Optional on purpose: a Member's form does not render these. `undefined` means "leave the
    // column alone" — sending a default would make the column-guard trigger raise 42501 whenever
    // an admin had set a different value.
    viaCompany: z.boolean().optional(),
    refundStatus: z.enum(REFUND_STATUSES).optional(),
    notes: blankToNull(z.string().trim().max(2000, "Notes can have at most 2000 characters")),
  })
  .superRefine((value, ctx) => {
    // Decision #72: training_records holds results; the journey is a learning item.
    if (value.status !== "done") {
      ctx.addIssue({ code: "custom", path: ["status"], message: "A certificate is a result. Track a course or an exam you are preparing on the Learning tab." });
    }
    for (const issue of recordRuleIssues(value, todayVn())) {
      ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
    }
  });
export type RecordInput = z.infer<typeof recordSchema>;
