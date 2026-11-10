import type { CurrentUser } from "@/features/auth/queries";
import type { Role } from "@/components/status/labels";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

export type MyProfile = {
  linked: boolean;
  fullName: string | null;
  email: string;
  role: Role;
  memberCode: string | null;
  teamName: string | null;
  scopes: { kind: "team" | "program"; name: string }[];
};

/** The signed-in user's own account. RLS lets everyone read their own member row; `manager_scopes` shows only their own rows. */
export async function getMyProfile(user: CurrentUser): Promise<Result<MyProfile>> {
  const supabase = await createClient();
  const [member, scopes] = await Promise.all([
    user.memberId
      ? supabase.from("members").select("full_name, code, teams(name)").eq("id", user.memberId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    user.role === "manager"
      ? supabase.from("manager_scopes").select("team_id, teams(name), programs(name)").eq("user_id", user.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  // A linked account whose member row is missing must not look unlinked.
  const missingMember = user.memberId !== null && !member.data;
  if (member.error || scopes.error || missingMember) {
    console.error("profile failed", member.error?.message ?? scopes.error?.message ?? "member row missing");
    return err("Could not load the data.");
  }
  return ok({
    linked: user.memberId !== null,
    fullName: member.data?.full_name ?? null,
    email: user.email,
    role: user.role,
    memberCode: member.data?.code ?? null,
    teamName: member.data?.teams?.name ?? null,
    scopes: (scopes.data ?? []).flatMap((row): MyProfile["scopes"] =>
      row.teams ? [{ kind: "team", name: row.teams.name }] : row.programs ? [{ kind: "program", name: row.programs.name }] : [],
    ),
  });
}
