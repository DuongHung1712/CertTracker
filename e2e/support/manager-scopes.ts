import { signInAsSeedAdmin } from "./restore-seed";

/**
 * The seeded manager (manager@certtracker.test) has a profile but no member row, so the Manager picker on /org
 * and the "Manages" column on /members cannot show them. These helpers give them a member row for the length of a
 * test and put the database back afterwards. Everything runs as the seeded admin through RLS (no service role).
 */
export const MANAGER_USER_ID = "5eed0000-0000-0000-0000-00000000f00b";
export const MANAGER_NAME = "Quản Lý E2E";
export const SEED_PROGRAM_ID = "5eed0000-0000-0000-0000-0000000000f1";
export const SEED_PROGRAM_NAME = "Digital Delivery";
const SEED_TEAM_CLOUD_ID = "5eed0000-0000-0000-0000-00000000a001";
const MANAGER_EMAIL = "manager-e2e@certtracker.test";

type Admin = Awaited<ReturnType<typeof signInAsSeedAdmin>>;

function must<T extends { error: { message: string } | null }>(result: T, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result;
}

async function removeManagerMember(admin: Admin) {
  must(await admin.from("profiles").update({ member_id: null }).eq("user_id", MANAGER_USER_ID), "unlink manager profile");
  must(await admin.from("members").delete().eq("email", MANAGER_EMAIL), "delete manager member");
}

/** Gives the seeded manager a member row (in Team Cloud) and returns a cleanup that restores the seed state. */
export async function giveSeedManagerAMember(): Promise<() => Promise<void>> {
  const admin = await signInAsSeedAdmin();
  await removeManagerMember(admin);
  const { data } = must(
    await admin
      .from("members")
      .insert({ full_name: MANAGER_NAME, email: MANAGER_EMAIL, team_id: SEED_TEAM_CLOUD_ID })
      .select("id")
      .single(),
    "insert manager member",
  );
  must(await admin.from("profiles").update({ member_id: data!.id }).eq("user_id", MANAGER_USER_ID), "link manager profile");
  return async () => {
    const cleanupAdmin = await signInAsSeedAdmin();
    await removeManagerMember(cleanupAdmin);
  };
}

export async function addSeedManagerProgramScope(): Promise<void> {
  const admin = await signInAsSeedAdmin();
  must(await admin.from("manager_scopes").insert({ user_id: MANAGER_USER_ID, program_id: SEED_PROGRAM_ID }), "add program scope");
}

export async function removeSeedManagerProgramScope(): Promise<void> {
  const admin = await signInAsSeedAdmin();
  must(await admin.from("manager_scopes").delete().eq("user_id", MANAGER_USER_ID).eq("program_id", SEED_PROGRAM_ID), "remove program scope");
}

export async function setSeedManagerRole(role: "manager" | "member"): Promise<void> {
  const admin = await signInAsSeedAdmin();
  must(await admin.from("profiles").update({ role }).eq("user_id", MANAGER_USER_ID), "set manager role");
}
