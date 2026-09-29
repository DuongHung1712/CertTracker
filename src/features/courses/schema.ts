import { z } from "zod";

export const certTypeSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên loại chứng chỉ"),
});
export type CertTypeInput = z.infer<typeof certTypeSchema>;

export const providerSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên nhà cung cấp"),
});
export type ProviderInput = z.infer<typeof providerSchema>;

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema.nullable());

export const courseSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên khóa học"),
  certTypeId: z.string().uuid("Vui lòng chọn loại chứng chỉ"),
  providerId: z.string().uuid("Vui lòng chọn nhà cung cấp"),
  level: z.string().trim().optional().default(""),
  validityMonths: emptyToNull(z.coerce.number().int().positive("Thời hạn phải lớn hơn 0")),
  refundable: z.boolean().default(false),
  cost: emptyToNull(z.coerce.number().nonnegative("Chi phí không được âm")),
  estHours: emptyToNull(z.coerce.number().int().positive("Số giờ phải lớn hơn 0")),
  url: emptyToNull(z.string().trim().url("Đường dẫn không hợp lệ")),
});
export type CourseInput = z.infer<typeof courseSchema>;
