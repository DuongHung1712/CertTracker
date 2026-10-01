import type { PlannedRow } from "@/features/import/plan";
import type { Json } from "@/types/database";

/** Longest text kept per stored cell or message. A hostile or accidental 32 KB cell must not bloat staging. */
export const MAX_STORED_TEXT = 500;

const NUL = "\u0000";

/** Postgres jsonb cannot store NUL or lone surrogates; a single such cell would fail the whole insert. */
function storableText(text: string): string {
  return text.replaceAll(NUL, "").toWellFormed();
}

/** Deep-copies a JSON value with every string made storable (see `storableText`). Object keys are cleaned too. */
export function sanitizeJson(value: Json): Json {
  if (typeof value === "string") return storableText(value);
  if (Array.isArray(value)) return value.map(sanitizeJson);
  if (value !== null && typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const [key, entry] of Object.entries(value)) if (entry !== undefined) out[storableText(key)] = sanitizeJson(entry);
    return out;
  }
  return value;
}

/**
 * Cut `text` to `max` characters (plus an ellipsis). Also drops NUL and repairs lone surrogates,
 * including one created by the cut itself (a pair split in half).
 */
export function truncateText(text: string, max: number = MAX_STORED_TEXT): string {
  const clean = text.replaceAll(NUL, "");
  return storableText(clean.length > max ? `${clean.slice(0, max)}…` : clean);
}

function truncateNullable(text: string | null): string | null {
  return text === null ? null : truncateText(text);
}

/** Caps every text in `raw` (cell values, header keys, the two display fields). Numbers, booleans and nulls pass through. */
export function capRaw(raw: PlannedRow["raw"]): PlannedRow["raw"] {
  const cells: PlannedRow["raw"]["cells"] = {};
  for (const [key, value] of Object.entries(raw.cells)) {
    const capped = truncateText(key);
    // Truncated or duplicate headers can collide; the first one wins (same as the plan's own key collisions).
    if (capped in cells) continue;
    cells[capped] = typeof value === "string" ? truncateText(value) : value;
  }
  return { cells, email: truncateNullable(raw.email), course: truncateNullable(raw.course) };
}

export function capMessages(messages: string[]): string[] {
  return messages.map((message) => truncateText(message));
}
