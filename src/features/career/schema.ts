import { z } from "zod";
import { todayVn } from "@/lib/dates";

const FUTURE_MESSAGE = "Career start can't be in the future";

/** The fields without the "not in the future" check, which needs a clock. */
export const careerStartShape = z.object({
  year: z.coerce.number("Enter a year").int("Enter a year").min(1970, "Enter a year from 1970"),
  month: z.coerce.number().int().min(1, "Choose a month").max(12, "Choose a month").nullable(),
});

/**
 * Month + year of the first job. `month` is optional: a year alone is stored as January of that year.
 * Built per request with `now` so the "not in the future" boundary (Vietnam month, `todayVn`) is testable;
 * the database trigger rejects a future start on every path as well.
 */
export function makeCareerStartSchema(now: Date) {
  const [currentYear, currentMonth] = todayVn(now).split("-").map(Number) as [number, number];
  return careerStartShape
    .refine(({ year }) => year <= currentYear, { message: FUTURE_MESSAGE, path: ["year"] })
    .refine(({ year, month }) => year < currentYear || month === null || month <= currentMonth, {
      message: FUTURE_MESSAGE,
      path: ["month"],
    });
}
export type CareerStartInput = z.input<ReturnType<typeof makeCareerStartSchema>>;
export type CareerStart = z.output<ReturnType<typeof makeCareerStartSchema>>;

/** `{ year: 2020, month: 3 }` → `2020-03-01`; no month → January. */
export function careerStartToDate({ year, month }: CareerStart): string {
  return `${year}-${String(month ?? 1).padStart(2, "0")}-01`;
}

/** `2020-03-01` → `{ year: 2020, month: 3 }` (the stored date is always the first of a month). */
export function dateToCareerStart(date: string | null): { year: number | null; month: number | null } {
  if (!date) return { year: null, month: null };
  const [year, month] = date.split("-").map(Number) as [number, number];
  return { year, month };
}

export const careerRoleSchema = z.object({
  name: z.string().trim().min(1, "Enter a role name").max(80, "Use at most 80 characters"),
});
export type CareerRoleInput = z.infer<typeof careerRoleSchema>;

/** `z.guid()`, not `.uuid()`: the seed ids are not RFC 4122 versioned (same reason as `idSchema` in organizations). */
export const careerRoleIdSchema = z.object({ id: z.guid("Invalid data") });

export const moveCareerRoleSchema = careerRoleIdSchema.extend({ direction: z.enum(["up", "down"]) });
export type MoveCareerRoleInput = z.infer<typeof moveCareerRoleSchema>;
