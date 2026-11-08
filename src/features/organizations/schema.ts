import { z } from "zod";

export const dcSchema = z.object({
  name: z.string().trim().min(1, "Enter the centre name"),
});
export type DcInput = z.infer<typeof dcSchema>;

/**
 * Server-side id validation for update/delete actions (CLAUDE.md invariant #6 — validate with
 * Zod on the server even though the client already validated). `z.guid()`, not `.uuid()`: it
 * checks the 8-4-4-4-12 hex shape without the RFC4122 version/variant nibbles that `.uuid()`
 * requires, which the local seed data's crafted `5eed…` ids don't have; it still rejects garbage
 * strings, and the FK constraint in Postgres enforces the id actually exists.
 */
export const idSchema = z.object({ id: z.guid("Invalid data") });

export const programSchema = z.object({
  name: z.string().trim().min(1, "Enter the program name"),
  // z.guid(), not .uuid(): see the comment on `idSchema` above.
  dcId: z.guid("Choose a centre"),
});
export type ProgramInput = z.infer<typeof programSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Enter the team name"),
  // z.guid(), not .uuid(): see the comment on `idSchema` above.
  programId: z.guid("Choose a program"),
});
export type TeamInput = z.infer<typeof teamSchema>;

export const scopeKindSchema = z.enum(["team", "program"]);
export type ScopeKind = z.infer<typeof scopeKindSchema>;
export type ManagerScope = { kind: ScopeKind; id: string };

/** The manager set of one team or program. `z.guid()`, not `.uuid()`: see the comment on `idSchema` above. */
export const scopeManagersSchema = z.object({
  scope: z.object({ kind: scopeKindSchema, id: z.guid("Invalid data") }),
  userIds: z.array(z.guid("Invalid data")),
});
export type ScopeManagersInput = z.infer<typeof scopeManagersSchema>;

/** Input for removing every manager scope of one user. */
export const removeScopesSchema = z.object({ userId: z.guid("Invalid data") });
export type RemoveScopesInput = z.infer<typeof removeScopesSchema>;
