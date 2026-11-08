import { z } from "zod";
import { careerStartShape, makeCareerStartSchema } from "@/features/career/schema";

export const memberSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the full name"),
  email: z.string().trim().email("Enter a valid email address"),
  // z.guid(), not .uuid(): see the comment on `idSchema` below.
  teamId: z.guid("Choose a team"),
  isActive: z.boolean().default(true),
  // Admin only (the database trigger rejects anyone else). `undefined` = leave as is, `null` = clear.
  careerRoleId: z.guid("Invalid data").nullable().optional(),
  careerStart: careerStartShape.nullable().optional(),
});
export type MemberInput = z.infer<typeof memberSchema>;

/** `memberSchema` plus the "career start is not in the future" rule for the given moment. Build it per request. */
export function makeMemberSchema(now: Date) {
  return memberSchema.extend({ careerStart: makeCareerStartSchema(now).nullable().optional() });
}

/**
 * Server-side id validation for update/delete actions (CLAUDE.md invariant #6 — validate with
 * Zod on the server even though the client already validated). `z.guid()`, not `.uuid()`: it
 * checks the 8-4-4-4-12 hex shape without the RFC4122 version/variant nibbles that `.uuid()`
 * requires, which the local seed data's crafted `5eed…` ids don't have; it still rejects garbage
 * strings, and the FK constraint in Postgres enforces the id actually exists.
 */
export const idSchema = z.object({ id: z.guid("Invalid data") });

export const memberAccessSchema = z.object({
  userId: z.guid("Invalid data"),
  role: z.enum(["admin", "manager", "member"], "Invalid data"),
});
export type MemberAccessInput = z.infer<typeof memberAccessSchema>;
