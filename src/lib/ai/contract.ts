import { z } from "zod";
import { toIsoDate } from "@/lib/dates";

/** Wire contract of the AI gateway. A future Rust service implements the same JSON; fields are only added, never changed. */
export const CONTRACT_VERSION = "v1";

export const AI_FEATURES = ["certificate-reader"] as const;
export const MAX_PAGES = 3;
export const MAX_CATALOGUE = 300;

export const AI_ERROR_CODES = ["disabled", "daily_limit", "unreadable", "timeout", "provider_error", "invalid_output"] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

// Strict ISO only: `toIsoDate` also accepts dd/mm/yyyy, and a partial date ("June 2025") is not a date here.
const isoDate = z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toIsoDate(value) === value, "Enter a valid ISO date");
// `z.guid()`, not `.uuid()`: seed ids are not RFC 4122 (same reason as `recordSchema`).
const id = z.guid();

export const extractRequestSchema = z.object({
  feature: z.enum(AI_FEATURES),
  /** The member code (a pseudonym), never a name or e-mail. Key of the daily limit. */
  requestedBy: z.string().min(1),
  pages: z.array(z.object({ mime: z.enum(IMAGE_MIMES), bytesBase64: z.string().min(1) })).min(1).max(MAX_PAGES),
  catalogue: z
    .array(z.object({ id, kind: z.enum(["exam", "completion"]), name: z.string(), provider: z.string() }))
    .max(MAX_CATALOGUE),
});
export type ExtractRequest = z.infer<typeof extractRequestSchema>;

const examResult = z.object({
  kind: z.literal("exam"),
  certificateId: id.nullable(),
  certificateName: z.string().nullable(),
  provider: z.string().nullable(),
  issuedDate: isoDate.nullable(),
  /** Shown to the member for comparison only: expiry is computed from the catalogue's validity. */
  validUntil: isoDate.nullable(),
  verifyUrl: z.url({ protocol: /^https?$/ }).nullable(),
});

const completionResult = z.object({
  kind: z.literal("completion"),
  certificateId: id.nullable(),
  courseName: z.string().nullable(),
  provider: z.string().nullable(),
  completedDate: isoDate.nullable(),
});

/** The field schemas per kind, so a reader can null one bad field instead of losing the whole answer. */
export const RESULT_FIELDS = { exam: examResult.shape, completion: completionResult.shape } as const;

export const extractResultSchema = z.discriminatedUnion("kind", [examResult, completionResult]);
export type ExtractResult = z.infer<typeof extractResultSchema>;

export const extractResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    result: extractResultSchema,
    /** Field name to 0–1. A field the model cannot read is `null` with confidence 0. */
    confidence: z.record(z.string(), z.number().min(0).max(1)),
    usage: z.object({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) }),
  }),
  z.object({ ok: z.literal(false), error: z.enum(AI_ERROR_CODES) }),
]);
export type ExtractResponse = z.infer<typeof extractResponseSchema>;
