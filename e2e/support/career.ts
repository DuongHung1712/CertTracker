import { signInAsSeedAdmin } from "./restore-seed";

/** Seed member "Lê Minh Châu" (Team Cloud, login member@certtracker.test). */
export const CAREER_MEMBER_ID = "5eed0000-0000-0000-0000-00000000b003";
export const CAREER_MEMBER_NAME = "Lê Minh Châu";

/** Completed months from the first of `startMonth` (1-12) of `startYear` to the current Vietnam month, in years rounded down to 0.5. */
export function expectedYoe(startYear: number, startMonth: number, today: Date = new Date()): number {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" })
    .format(today)
    .split("-")
    .map(Number) as [number, number];
  const months = Math.max(0, (year - startYear) * 12 + (month - startMonth));
  return Math.floor(months / 6) / 2;
}

/** Runs as the seeded admin through RLS: sets (or clears) the career role and start of the seed member. */
export async function setSeedMemberCareer(roleName: string | null, careerStart: string | null): Promise<void> {
  const admin = await signInAsSeedAdmin();
  let roleId: string | null = null;
  if (roleName) {
    const { data, error } = await admin.from("career_roles").select("id").eq("name", roleName).single();
    if (error) throw new Error(`read career role ${roleName}: ${error.message}`);
    roleId = data.id;
  }
  const { data, error } = await admin
    .from("members")
    .update({ career_role_id: roleId, career_start: careerStart })
    .eq("id", CAREER_MEMBER_ID)
    .select("id");
  if (error) throw new Error(`set seed member career: ${error.message}`);
  if (!data || data.length === 0) throw new Error("set seed member career: no row updated");
}

export async function deleteSeedCareerRole(name: string): Promise<void> {
  const admin = await signInAsSeedAdmin();
  const { error } = await admin.from("career_roles").delete().eq("name", name);
  if (error) throw new Error(`delete career role ${name}: ${error.message}`);
}
