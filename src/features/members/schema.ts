import { z } from "zod";

export const memberSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên"),
  email: z.string().trim().email("Email không hợp lệ"),
  // Not `.uuid()`: see comment on `certTypeId` in courses/schema.ts — the seed data's ids fail
  // Zod's strict RFC4122 format check; the FK constraint in Postgres enforces real integrity.
  teamId: z.string().min(1, "Vui lòng chọn team"),
  isActive: z.boolean().default(true),
});
export type MemberInput = z.infer<typeof memberSchema>;
