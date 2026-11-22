import { AI_READER_FEATURE } from "@/features/ai/schema";
import { createAiGateway } from "@/lib/ai/gateway";
import { createClient } from "@/lib/supabase/server";

export type AiReaderSettings = {
  enabled: boolean;
  dailyLimit: number;
  callsToday: number;
  provider: "deepseek" | "fake" | "not-configured";
};

/** Admin only: the function refuses anyone else, so a failure or an empty answer is `null` and the section is not shown. */
export async function getAiReaderSettings(): Promise<AiReaderSettings | null> {
  const { data, error } = await (await createClient()).rpc("get_ai_feature", { p_feature: AI_READER_FEATURE });
  const row = data?.[0];
  if (error || !row) return null;

  let provider: AiReaderSettings["provider"];
  try {
    provider = createAiGateway().transport;
  } catch {
    provider = "not-configured";
  }
  return { enabled: row.enabled, dailyLimit: row.daily_limit, callsToday: row.calls_today, provider };
}
