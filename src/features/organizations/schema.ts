import { z } from "zod";

export const dcSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên trung tâm"),
});
export type DcInput = z.infer<typeof dcSchema>;

/**
 * Server-side id validation for update/delete actions (CLAUDE.md invariant #6 — validate with
 * Zod on the server even though the client already validated). `z.guid()`, not `.uuid()`: it
 * checks the 8-4-4-4-12 hex shape without the RFC4122 version/variant nibbles that `.uuid()`
 * requires, which the local seed data's crafted `5eed…` ids don't have; it still rejects garbage
 * strings, and the FK constraint in Postgres enforces the id actually exists.
 */
export const idSchema = z.object({ id: z.guid("Dữ liệu không hợp lệ") });

export const programSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên chương trình"),
  // z.guid(), not .uuid(): see the comment on `idSchema` above.
  dcId: z.guid("Vui lòng chọn trung tâm"),
});
export type ProgramInput = z.infer<typeof programSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên team"),
  // z.guid(), not .uuid(): see the comment on `idSchema` above.
  programId: z.guid("Vui lòng chọn chương trình"),
});
export type TeamInput = z.infer<typeof teamSchema>;
