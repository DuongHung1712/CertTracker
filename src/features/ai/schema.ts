import { z } from "zod";

export const AI_READER_FEATURE = "certificate-reader";
export const MAX_DAILY_LIMIT = 200;

/** The admin form: the switch and the number of reads per member per day (a whole number from 1 to 200). */
export const aiReaderSettingsSchema = z.object({
  enabled: z.boolean("Choose on or off"),
  dailyLimit: z.coerce
    .number("Enter a number")
    .int("Enter a whole number")
    .min(1, "The limit must be at least 1")
    .max(MAX_DAILY_LIMIT, `The limit can be at most ${MAX_DAILY_LIMIT}`),
});
export type AiReaderSettingsInput = z.input<typeof aiReaderSettingsSchema>;
