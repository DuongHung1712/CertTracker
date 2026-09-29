import { z } from "zod";

export const memberSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên"),
  email: z.string().trim().email("Email không hợp lệ"),
  teamId: z.string().uuid("Vui lòng chọn team"),
  isActive: z.boolean().default(true),
});
export type MemberInput = z.infer<typeof memberSchema>;
