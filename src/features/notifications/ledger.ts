import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationKind } from "@/features/notifications/types";
import type { Database } from "@/types/database";

/** `attempt` is the claim token: pass it back to `markSent`/`markFailed`. */
export type ClaimResult = { claimed: true; id: string; attempt: number } | { claimed: false; reason: "sent" | "in-flight" };

export interface NotificationLedger {
  claim(kind: NotificationKind, period: string, email: string): Promise<ClaimResult>;
  /**
   * `false` when the claim was lost in the meantime: the row is no longer pending, or a stale-claim takeover
   * bumped `attempts` past the `attempt` this worker was given.
   */
  markSent(id: string, attempt: number, providerId: string | null): Promise<boolean>;
  /** `false` under the same conditions as `markSent`. */
  markFailed(id: string, attempt: number, error: string): Promise<boolean>;
}

const MAX_ERROR_LENGTH = 500;

export function createLedger(client: SupabaseClient<Database>): NotificationLedger {
  return {
    async claim(kind, period, email) {
      const { data, error } = await client.rpc("claim_notification", { p_kind: kind, p_period: period, p_email: email });
      if (error) throw new Error(`claim_notification failed: ${error.message}`);
      const row = data?.[0];
      if (!row) throw new Error("claim_notification returned no row");
      if (row.claimed) return { claimed: true, id: row.log_id, attempt: row.log_attempts };
      return { claimed: false, reason: row.log_status === "sent" ? "sent" : "in-flight" };
    },
    async markSent(id, attempt, providerId) {
      const { data, error } = await client
        .from("notification_log")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerId, error: null })
        .eq("id", id)
        .eq("status", "pending")
        .eq("attempts", attempt)
        .select("id");
      if (error) throw new Error(`markSent failed: ${error.message}`);
      return (data?.length ?? 0) === 1;
    },
    async markFailed(id, attempt, message) {
      const { data, error } = await client
        .from("notification_log")
        .update({ status: "failed", error: message.slice(0, MAX_ERROR_LENGTH) })
        .eq("id", id)
        .eq("status", "pending")
        .eq("attempts", attempt)
        .select("id");
      if (error) throw new Error(`markFailed failed: ${error.message}`);
      return (data?.length ?? 0) === 1;
    },
  };
}
