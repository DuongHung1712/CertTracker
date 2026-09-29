import { createClient } from "@/lib/supabase/server";

export async function listDcs() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dcs").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listPrograms() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, dc_id, dcs(name)")
    .order("name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({ id: row.id, name: row.name, dcId: row.dc_id, dcName: row.dcs?.name ?? "" }));
}

export async function listTeams() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, program_id, programs(name)")
    .order("name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    programId: row.program_id,
    programName: row.programs?.name ?? "",
  }));
}

/** Candidates to become a team's manager: signed-up users with role "manager" who also have a member profile (so we have a name/email to show). */
export async function listManagerCandidates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, members(id, full_name, email)")
    .eq("role", "manager")
    .not("member_id", "is", null);
  if (error) throw new Error(error.message);
  return data
    .filter((row) => row.members)
    .map((row) => ({ userId: row.user_id, fullName: row.members!.full_name, email: row.members!.email }));
}

/** Manager user_ids currently assigned to a team. A user only ever sees their own team_managers row (RLS), so this is Admin-only in practice — called from the Admin-only /org page. */
export async function listTeamManagerIds(teamId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_managers").select("user_id").eq("team_id", teamId);
  if (error) throw new Error(error.message);
  return data.map((row) => row.user_id);
}
