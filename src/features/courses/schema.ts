import { z } from "zod";
import { CURRENCIES } from "@/lib/money";

export const certTypeSchema = z.object({
  name: z.string().trim().min(1, "Enter the certificate type name"),
});
export type CertTypeInput = z.infer<typeof certTypeSchema>;

export const providerSchema = z.object({
  name: z.string().trim().min(1, "Enter the provider name"),
});
export type ProviderInput = z.infer<typeof providerSchema>;

/**
 * Server-side id validation for update/delete actions (CLAUDE.md invariant #6 — validate with
 * Zod on the server even though the client already validated). `z.guid()`, not `.uuid()`: it
 * checks the 8-4-4-4-12 hex shape without the RFC4122 version/variant nibbles that `.uuid()`
 * requires, which the local seed data's crafted `5eed…` ids don't have; it still rejects garbage
 * strings, and the FK constraint in Postgres enforces the id actually exists.
 */
export const idSchema = z.object({ id: z.guid("Invalid data") });

export const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());

/** The course fields without the cross-field rule, so a caller can `.extend()` them (e.g. with an id) and re-apply the rule. */
export const courseFields = z.object({
  name: z.string().trim().min(1, "Enter the course name"),
  // z.guid(), not .uuid(): see the comment on `idSchema` above.
  providerId: z.guid("Choose a provider"),
  /** The exam certificate this course prepares for; the database refuses a completion. */
  preparesForId: emptyToNull(z.guid("Invalid data")),
  refundable: z.boolean().default(false),
  cost: emptyToNull(z.coerce.number().nonnegative("Cost cannot be negative")),
  costCurrency: emptyToNull(z.enum(CURRENCIES)),
  estHours: emptyToNull(z.coerce.number().int().positive("Study hours must be greater than 0")),
  url: emptyToNull(z.string().trim().url("Enter a valid link")),
  refundConditions: z.preprocess(
    (value) => (value === undefined || (typeof value === "string" && value.trim() === "") ? null : value),
    z.string().trim().max(1000, "Refund conditions can have at most 1000 characters").nullable(),
  ),
});

/** A cost needs a currency and a currency needs a cost (the database enforces the same with a check constraint). */
export function requireCostWithCurrency(
  value: { cost: number | null; costCurrency: string | null },
  context: z.RefinementCtx,
): void {
  if (value.cost !== null && value.costCurrency === null) {
    context.addIssue({ code: "custom", path: ["costCurrency"], message: "Choose a currency for the cost" });
  } else if (value.cost === null && value.costCurrency !== null) {
    context.addIssue({ code: "custom", path: ["cost"], message: "Enter a cost or clear the currency" });
  }
}

/** Conditions only make sense for a refundable course, so they are dropped otherwise. */
function dropConditionsUnlessRefundable<T extends { refundable: boolean; refundConditions: string | null }>(value: T): T {
  return value.refundable ? value : { ...value, refundConditions: null };
}

export const courseSchema = courseFields.superRefine(requireCostWithCurrency).transform(dropConditionsUnlessRefundable);
export const courseWithIdSchema = courseFields
  .extend({ id: idSchema.shape.id })
  .superRefine(requireCostWithCurrency)
  .transform(dropConditionsUnlessRefundable);
export type CourseInput = z.infer<typeof courseSchema>;
