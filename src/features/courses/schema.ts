import { z } from "zod";

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

export const courseSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên khóa học"),
  // z.guid(), not .uuid(): see the comment on `idSchema` above.
  certTypeId: z.guid("Vui lòng chọn loại chứng chỉ"),
  providerId: z.guid("Vui lòng chọn nhà cung cấp"),
  level: z.string().trim().optional().default(""),
  validityMonths: emptyToNull(z.coerce.number().int().positive("Thời hạn phải lớn hơn 0")),
  refundable: z.boolean().default(false),
  cost: emptyToNull(z.coerce.number().nonnegative("Chi phí không được âm")),
  estHours: emptyToNull(z.coerce.number().int().positive("Số giờ phải lớn hơn 0")),
  url: emptyToNull(z.string().trim().url("Đường dẫn không hợp lệ")),
});
export type CourseInput = z.infer<typeof courseSchema>;
