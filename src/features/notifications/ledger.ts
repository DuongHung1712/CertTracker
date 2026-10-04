import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationKind } from "@/features/notifications/types";
import type { Database } from "@/types/database";

export type ClaimResult = { claimed: true; id: string } | { claimed: false; reason: "sent" | "in-flight" };

export interface NotificationLedger {
  claim(kind: NotificationKind, period: string, email: string): Promise<ClaimResult>;
  /** `false` when the claim was lost in the meantime (row no longer pending). */
  markSent(id: string, providerId: string | null): Promise<boolean>;
  markFailed(id: string, error: string): Promise<boolean>;
}

const MAX_ERROR_LENGTH = 500;

export function createLedger(client: SupabaseClient<Database>): NotificationLedger {
  return {
    async claim(kind, period, email) {
      const { data, error } = await client.rpc("claim_notification", { p_kind: kind, p_period: period, p_email: email });
      if (error) throw new Error(`claim_notification failed: ${error.message}`);
      const row = data?.[0];
      if (!row) throw new Error("claim_notification returned no row");
      if (row.claimed) return { claimed: true, id: row.log_id };
      return { claimed: false, reason: row.log_status === "sent" ? "sent" : "in-flight" };
    },
    async markSent(id, providerId) {
      const { data, error } = await client
        .from("notification_log")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerId, error: null })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) throw new Error(`markSent failed: ${error.message}`);
      return (data?.length ?? 0) === 1;
    },
    async markFailed(id, message) {
      const { data, error } = await client
        .from("notification_log")
        .update({ status: "failed", error: message.slice(0, MAX_ERROR_LENGTH) })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) throw new Error(`markFailed failed: ${error.message}`);
      return (data?.length ?? 0) === 1;
    },
  };
}
