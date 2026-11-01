import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export type CareerRole = { id: string; name: string; sortOrder: number };

export type MemberCareer = {
  careerRoleId: string | null;
  careerRoleName: string | null;
  /** First day of a month (`YYYY-MM-01`) or null. */
  careerStart: string | null;
  yoeYears: number | null;
};

/** Every signed-in user may read the role list (RLS: authenticated read). */
export async function listCareerRoles(): Promise<CareerRole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("career_roles").select("id, name, sort_order").order("sort_order");
  if (error) throw new Error(error.message);
  return data.map((row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order }));
}

/** Career profile per member, from `v_member_profiles` (security invoker: members RLS decides which rows come back). */
export async function listMemberCareers(): Promise<Map<string, MemberCareer>> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("v_member_profiles")
      .select("member_id, career_role_id, career_role_name, career_start, yoe_years")
      .order("member_id")
      .range(from, to),
  );
  const result = new Map<string, MemberCareer>();
  for (const row of rows) {
    if (!row.member_id) continue;
    result.set(row.member_id, {
      careerRoleId: row.career_role_id,
      careerRoleName: row.career_role_name,
      careerStart: row.career_start,
      yoeYears: row.yoe_years,
    });
  }
  return result;
}

export async function getMemberCareer(memberId: string): Promise<MemberCareer> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_member_profiles")
    .select("career_role_id, career_role_name, career_start, yoe_years")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    careerRoleId: data?.career_role_id ?? null,
    careerRoleName: data?.career_role_name ?? null,
    careerStart: data?.career_start ?? null,
    yoeYears: data?.yoe_years ?? null,
  };
}
