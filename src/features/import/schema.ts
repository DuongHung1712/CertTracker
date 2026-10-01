import { z } from "zod";

export const batchIdSchema = z.object({ batchId: z.guid("Dữ liệu không hợp lệ") });

export const importSummarySchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
  newMembers: z.number().int(),
  newCourses: z.number().int(),
});
export type ImportSummary = z.infer<typeof importSummarySchema>;

/** Errors/warnings are plain strings; anything else read back from jsonb degrades to "no messages". */
export const messagesSchema = z.array(z.string()).catch([]);

/** The `raw` column: what the file said, for the preview table. Mirrors `PlannedRow["raw"]`. */
export const rawSchema = z
  .object({
    cells: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    email: z.string().nullable(),
    course: z.string().nullable(),
  })
  .catch({ cells: {}, email: null, course: null });

const catalogRefSchema = z.union([z.object({ id: z.string() }), z.object({ name: z.string() })]);

/**
 * The part of the `normalized` column the client reads (the "new entities" summary): which member and
 * course a row points at, and for a new course which provider / cert type it will create. Unknown keys
 * are stripped; a malformed or missing value becomes `null`.
 */
export const normalizedRefsSchema = z
  .object({
    member: z.union([z.object({ id: z.string() }), z.object({ email: z.string(), fullName: z.string() })]),
    course: z.union([
      z.object({ id: z.string() }),
      z.object({ name: z.string(), provider: catalogRefSchema, certType: catalogRefSchema.nullable() }),
    ]),
  })
  .nullable()
  .catch(null);
export type NormalizedRefs = z.infer<typeof normalizedRefsSchema>;

export const importActionSchema = z.enum(["create", "update", "skip"]);
export const importStatusSchema = z.enum(["parsed", "committed", "discarded"]);
