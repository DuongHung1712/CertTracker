import { getCurrentUser } from "@/features/auth/queries";
import { createClient } from "@/lib/supabase/server";

export async function listMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, code, full_name, email, team_id, is_active, teams(name)")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    email: row.email,
    teamId: row.team_id,
    teamName: row.teams?.name ?? null,
    isActive: row.is_active,
  }));
}

/** All teams for Admin; only the teams this user manages for Manager. `teams` itself has no role restriction (spec §5), so the filtering here is for form UX, not security. */
export async function listTeamOptionsForCurrentUser() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (user?.role === "admin") {
    const { data, error } = await supabase.from("teams").select("id, name").order("name");
    if (error) throw new Error(error.message);
    return data;
  }

  const { data: managed, error: managedError } = await supabase.from("team_managers").select("team_id");
  if (managedError) throw new Error(managedError.message);
  const teamIds = managed.map((row) => row.team_id);
  if (teamIds.length === 0) return [];

  const { data, error } = await supabase.from("teams").select("id, name").in("id", teamIds).order("name");
  if (error) throw new Error(error.message);
  return data;
}
