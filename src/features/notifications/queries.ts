import { summarizeRuns, type RunRow } from "@/features/notifications/runs";
import type { NotificationKind } from "@/features/notifications/types";
import { createClient } from "@/lib/supabase/server";

/** Admin only: the policy on `notification_log` returns nothing to other roles. The newest 500 rows are plenty for a history view. */
export async function listNotificationRuns(): Promise<RunRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_log")
    .select("kind, period, status, sent_at, claimed_at")
    .order("claimed_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Không tải được lịch sử gửi email: ${error.message}`);
  return summarizeRuns(
    data.map((r) => ({
      kind: r.kind as NotificationKind,
      period: r.period,
      status: r.status as "pending" | "sent" | "failed",
      sentAt: r.sent_at,
      claimedAt: r.claimed_at,
    })),
  );
}
