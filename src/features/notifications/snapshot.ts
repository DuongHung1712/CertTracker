import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/components/status/labels";
import type { Snapshot, SnapshotRecord } from "@/features/notifications/types";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Database } from "@/types/database";

/**
 * Everything the planners need, read with the service-role client (RLS bypassed — the planners, not RLS,
 * scope each recipient's data). Row counts are small, but PostgREST caps responses at 1000 rows, so page.
 */
export async function loadSnapshot(client: SupabaseClient<Database>): Promise<Snapshot> {
  const [members, teams, staff, records] = await Promise.all([
    fetchAllRows((from, to) =>
      client.from("members").select("id, code, full_name, email, team_id, is_active").order("id").range(from, to),
    ),
    fetchAllRows((from, to) => client.from("teams").select("id, name").order("id").range(from, to)),
    client.rpc("notification_staff"),
    fetchAllRows((from, to) =>
      client
        .from("v_training_records")
        .select("id, member_id, status, course_name, issued_date, expiry_date, days_to_expiry, expiry_status")
        .order("id")
        .range(from, to),
    ),
  ]);
  if (staff.error) throw new Error(`notification_staff failed: ${staff.error.message}`);

  return {
    members: members.map((m) => ({
      id: m.id, code: m.code, fullName: m.full_name, email: m.email, teamId: m.team_id, isActive: m.is_active,
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    staff: (staff.data ?? []).map((s) => ({
      userId: s.user_id, email: s.email, role: s.role as Role, memberId: s.member_id, teamIds: s.team_ids,
    })),
    // The view's generated types are all-nullable; the underlying columns are NOT NULL.
    records: records.flatMap((r): SnapshotRecord[] =>
      r.id && r.member_id && r.status
        ? [
            {
              id: r.id, memberId: r.member_id, status: r.status, courseName: r.course_name ?? "",
              issuedDate: r.issued_date, expiryDate: r.expiry_date, daysToExpiry: r.days_to_expiry,
              expiryStatus: r.expiry_status ?? "N/A",
            },
          ]
        : [],
    ),
  };
}
