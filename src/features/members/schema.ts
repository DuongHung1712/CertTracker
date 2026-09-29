import { z } from "zod";

export const memberSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên"),
  email: z.string().trim().email("Email không hợp lệ"),
  // z.guid(), not .uuid(): see the comment on `idSchema` below.
  teamId: z.guid("Vui lòng chọn team"),
  isActive: z.boolean().default(true),
});
export type MemberInput = z.infer<typeof memberSchema>;

/**
 * Server-side id validation for update/delete actions (CLAUDE.md invariant #6 — validate with
 * Zod on the server even though the client already validated). `z.guid()`, not `.uuid()`: it
 * checks the 8-4-4-4-12 hex shape without the RFC4122 version/variant nibbles that `.uuid()`
 * requires, which the local seed data's crafted `5eed…` ids don't have; it still rejects garbage
 * strings, and the FK constraint in Postgres enforces the id actually exists.
 */
export const idSchema = z.object({ id: z.guid("Dữ liệu không hợp lệ") });
