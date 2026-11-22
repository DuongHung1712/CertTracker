import "server-only";
import type { AiErrorCode } from "@/lib/ai/contract";
import { createAdminClient } from "@/lib/supabase/admin";

export type FinishOutcome = Exclude<AiErrorCode, "disabled" | "daily_limit"> | "ok";

export interface UsageStore {
  isEnabled(feature: string): Promise<boolean>;
  /** Checks the switch and the daily limit and records the call in one database transaction. Fails closed. */
  claim(feature: string, memberCode: string): Promise<{ ok: true; usageId: string } | { ok: false; reason: "disabled" | "daily_limit" }>;
  /** Never throws: a lost log row must not break the member's request. */
  finish(usageId: string, usage: { inputTokens: number; outputTokens: number; costMicroUsd: number; outcome: FinishOutcome }): Promise<void>;
}

/**
 * Service-role access to `ai_usage` and `ai_feature_flags` only (decision #75, an exception to #35). Nothing the model sees
 * comes through here: prompt data is read with the user's JWT, so RLS still applies to it.
 */
export function createUsageStore(): UsageStore {
  return {
    async isEnabled(feature) {
      try {
        const { data, error } = await createAdminClient().from("ai_feature_flags").select("enabled").eq("feature", feature).maybeSingle();
        return !error && data?.enabled === true;
      } catch {
        return false;
      }
    },

    async claim(feature, memberCode) {
      try {
        const { data, error } = await createAdminClient().rpc("claim_ai_call", { p_feature: feature, p_member_code: memberCode });
        const row = data?.[0];
        if (error || !row) return { ok: false, reason: "disabled" };
        if (row.refusal === "daily_limit") return { ok: false, reason: "daily_limit" };
        if (row.refusal || !row.usage_id) return { ok: false, reason: "disabled" };
        return { ok: true, usageId: row.usage_id };
      } catch {
        return { ok: false, reason: "disabled" };
      }
    },

    async finish(usageId, usage) {
      try {
        const { error } = await createAdminClient().rpc("finish_ai_call", {
          p_id: usageId,
          p_input: usage.inputTokens,
          p_output: usage.outputTokens,
          p_cost: usage.costMicroUsd,
          p_outcome: usage.outcome,
        });
        if (error) console.error("ai usage finish failed", error.message);
      } catch (cause) {
        console.error("ai usage finish failed", cause instanceof Error ? cause.message : "unknown");
      }
    },
  };
}
