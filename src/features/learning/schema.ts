import { z } from "zod";
import { blankToNull, optionalDate, RECORD_STATUSES } from "@/features/records/schema";
import { todayVn } from "@/lib/dates";

/**
 * A learning item: the journey (decision #72). A course, an exam being prepared for, or both.
 * The database checks the same rules (learning_items CHECK + trigger); this gives the form its messages.
 */
export const learningSchema = z
  .object({
    memberId: z.guid("Choose a member"),
    courseId: blankToNull(z.guid("Invalid data")),
    targetCertificateId: blankToNull(z.guid("Invalid data")),
    status: z.enum(RECORD_STATUSES, "Choose a status"),
    progress: z.coerce
      .number("Progress must be a number")
      .int("Progress must be a whole number")
      .min(0, "Progress must be between 0 and 100")
      .max(100, "Progress must be between 0 and 100"),
    plannedDate: optionalDate("Enter a valid date (dd/mm/yyyy)"),
    finishedDate: optionalDate("Enter a valid date (dd/mm/yyyy)"),
    notes: blankToNull(z.string().trim().max(2000, "Notes can have at most 2000 characters")),
  })
  .superRefine((value, ctx) => {
    if (!value.courseId && !value.targetCertificateId) {
      ctx.addIssue({ code: "custom", path: ["courseId"], message: "Choose a course or an exam" });
    }
    if (value.status === "done" && !value.finishedDate) {
      ctx.addIssue({ code: "custom", path: ["finishedDate"], message: "Enter the date you finished" });
    }
    // ISO dates compare correctly as strings.
    if (value.finishedDate && value.finishedDate > todayVn()) {
      ctx.addIssue({ code: "custom", path: ["finishedDate"], message: "The date cannot be in the future" });
    }
  });
export type LearningInput = z.infer<typeof learningSchema>;
