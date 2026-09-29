import { z } from "zod";

export const dcSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên trung tâm"),
});
export type DcInput = z.infer<typeof dcSchema>;

export const programSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên chương trình"),
  dcId: z.string().uuid("Vui lòng chọn trung tâm"),
});
export type ProgramInput = z.infer<typeof programSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên team"),
  programId: z.string().uuid("Vui lòng chọn chương trình"),
});
export type TeamInput = z.infer<typeof teamSchema>;
