import { z } from "zod";

export const dcSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên trung tâm"),
});
export type DcInput = z.infer<typeof dcSchema>;

export const programSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên chương trình"),
  // Not `.uuid()`: see comment on `certTypeId` in courses/schema.ts — the seed data's ids fail
  // Zod's strict RFC4122 format check; the FK constraint in Postgres enforces real integrity.
  dcId: z.string().min(1, "Vui lòng chọn trung tâm"),
});
export type ProgramInput = z.infer<typeof programSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên team"),
  // Not `.uuid()`: see comment on `certTypeId` in courses/schema.ts — the seed data's ids fail
  // Zod's strict RFC4122 format check; the FK constraint in Postgres enforces real integrity.
  programId: z.string().min(1, "Vui lòng chọn chương trình"),
});
export type TeamInput = z.infer<typeof teamSchema>;
