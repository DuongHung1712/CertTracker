"use server";

import { revalidatePath } from "next/cache";
import { AI_READER_FEATURE, aiReaderSettingsSchema } from "@/features/ai/schema";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

const INSUFFICIENT_PRIVILEGE = "42501";

/** Admin only: `set_ai_feature` checks the role in the database; this action only validates the input first. */
export async function saveAiReaderSettings(input: unknown): Promise<Result<null>> {
  const parsed = aiReaderSettingsSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");

  const { error } = await (await createClient()).rpc("set_ai_feature", {
    p_feature: AI_READER_FEATURE,
    p_enabled: parsed.data.enabled,
    p_daily_limit: parsed.data.dailyLimit,
  });
  if (error) return err(error.code === INSUFFICIENT_PRIVILEGE ? "You do not have permission to do this." : "Something went wrong. Try again.");

  // The sheet on these pages shows or hides its upload card from the flag.
  for (const path of ["/settings", "/records", "/me"]) revalidatePath(path);
  return ok(null);
}
