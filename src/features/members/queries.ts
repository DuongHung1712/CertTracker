import { getCurrentUser } from "@/features/auth/queries";
import { createClient } from "@/lib/supabase/server";

export async function listMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, code, full_name, email, team_id, is_active, teams(name), profiles(user_id)")
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
    userId: row.profiles?.user_id ?? null,
  }));
}

/**
 * All teams for Admin; only the teams this user manages for Manager, resolved by the database
 * (`managed_team_ids()`: team scopes plus the teams of program scopes). `teams` itself has no role
 * restriction (spec §5), so this narrowing is for form UX, not security.
 */
export async function listTeamOptionsForCurrentUser() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (user?.role === "admin") {
    const { data, error } = await supabase.from("teams").select("id, name").order("name");
    if (error) throw new Error(error.message);
    return data;
  }

  const { data: teamIds, error: managedError } = await supabase.rpc("managed_team_ids");
  if (managedError) throw new Error(managedError.message);
  if (teamIds.length === 0) return [];

  const { data, error } = await supabase.from("teams").select("id, name").in("id", teamIds).order("name");
  if (error) throw new Error(error.message);
  return data;
}

export type MemberScope = { label: string; active: boolean };

/**
 * Manager scopes per user, for the "Manages" column. A user only reads their own scope rows (RLS), so only the
 * Admin gets the full picture. `active` is false when the user's role is no longer "manager": the rows are kept
 * but grant nothing.
 */
export async function listMemberScopes(): Promise<Map<string, MemberScope[]>> {
  const supabase = await createClient();
  const { data: scopes, error } = await supabase
    .from("manager_scopes")
    .select("user_id, teams(name), programs(name)");
  if (error) throw new Error(error.message);
  const result = new Map<string, MemberScope[]>();
  if (scopes.length === 0) return result;

  const userIds = [...new Set(scopes.map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, role")
    .in("user_id", userIds);
  if (profilesError) throw new Error(profilesError.message);
  const activeByUser = new Map(profiles.map((row) => [row.user_id, row.role === "manager"]));

  // Teams first, then programs; each group alphabetical.
  const labelled = scopes
    .map((row) => ({
      userId: row.user_id,
      label: row.teams?.name ?? row.programs?.name ?? "",
      isProgram: row.teams === null,
    }))
    .filter((row) => row.label !== "")
    .sort((a, b) => Number(a.isProgram) - Number(b.isProgram) || a.label.localeCompare(b.label));
  for (const row of labelled) {
    const list = result.get(row.userId) ?? [];
    list.push({ label: row.label, active: activeByUser.get(row.userId) ?? false });
    result.set(row.userId, list);
  }
  return result;
}
