import { z } from "zod";
import { CURRENCIES } from "@/lib/money";

export const certTypeSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên loại chứng chỉ"),
});
export type CertTypeInput = z.infer<typeof certTypeSchema>;

export const providerSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên nhà cung cấp"),
});
export type ProviderInput = z.infer<typeof providerSchema>;

/**
 * Server-side id validation for update/delete actions (CLAUDE.md invariant #6 — validate with
 * Zod on the server even though the client already validated). `z.guid()`, not `.uuid()`: it
 * checks the 8-4-4-4-12 hex shape without the RFC4122 version/variant nibbles that `.uuid()`
 * requires, which the local seed data's crafted `5eed…` ids don't have; it still rejects garbage
 * strings, and the FK constraint in Postgres enforces the id actually exists.
 */
export const idSchema = z.object({ id: z.guid("Dữ liệu không hợp lệ") });

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());

/** The course fields without the cross-field rule, so a caller can `.extend()` them (e.g. with an id) and re-apply the rule. */
export const courseFields = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên khóa học"),
  // z.guid(), not .uuid(): see the comment on `idSchema` above.
  certTypeId: z.guid("Vui lòng chọn loại chứng chỉ"),
  providerId: z.guid("Vui lòng chọn nhà cung cấp"),
  level: z.string().trim().optional().default(""),
  validityMonths: emptyToNull(z.coerce.number().int().positive("Thời hạn phải lớn hơn 0")),
  refundable: z.boolean().default(false),
  cost: emptyToNull(z.coerce.number().nonnegative("Chi phí không được âm")),
  costCurrency: emptyToNull(z.enum(CURRENCIES)),
  estHours: emptyToNull(z.coerce.number().int().positive("Số giờ phải lớn hơn 0")),
  url: emptyToNull(z.string().trim().url("Đường dẫn không hợp lệ")),
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

export const courseSchema = courseFields.superRefine(requireCostWithCurrency);
export const courseWithIdSchema = courseFields.extend({ id: idSchema.shape.id }).superRefine(requireCostWithCurrency);
export type CourseInput = z.infer<typeof courseSchema>;
