"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/queries";
import { readFirstSheet } from "@/features/import/workbook";
import { planMemberImport, type MemberImportRow } from "@/features/members/import-plan";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

type Plan = { rows: MemberImportRow[]; counts: { create: number; skip: number; error: number } };

const LOAD_ERROR = "Could not read the members. Try again.";

/** Reads the uploaded file and plans it against the current members, teams and roles, all through the user's client. */
async function planFromForm(formData: FormData): Promise<Result<Plan>> {
  try {
    const user = await getCurrentUser();
    if (user?.role !== "admin") return err("Only an admin can import members.");
    const file = formData.get("file");
    if (!(file instanceof File)) return err("Choose a file to import.");

    const sheet = readFirstSheet(new Uint8Array(await file.arrayBuffer()));
    if (!sheet.ok) return err(sheet.error);

    const supabase = await createClient();
    const [members, teams, careerRoles] = await Promise.all([
      supabase.from("members").select("email"),
      supabase.from("teams").select("id, name"),
      supabase.from("career_roles").select("id, name"),
    ]);
    if (members.error || teams.error || careerRoles.error) return err(LOAD_ERROR);

    const plan = planMemberImport(sheet.value.rows, {
      memberEmails: members.data.map((row) => row.email),
      teams: teams.data,
      careerRoles: careerRoles.data,
    });
    return plan.ok ? ok(plan.value) : err(plan.error);
  } catch {
    return err(LOAD_ERROR);
  }
}

export async function previewMemberImport(formData: FormData): Promise<Result<Plan>> {
  return planFromForm(formData);
}

/** Re-plans the file on the server (the client's preview is not trusted) and inserts every `create` row in one statement. */
export async function importMembers(formData: FormData): Promise<Result<{ created: number }>> {
  const plan = await planFromForm(formData);
  if (!plan.ok) return plan;
  const toCreate = plan.data.rows.filter((row) => row.action === "create");
  if (toCreate.length === 0) return err("There are no members to create.");

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("members").insert(
      toCreate.map((row) => ({
        full_name: row.fullName!,
        email: row.email!,
        team_id: row.teamId,
        is_active: true,
        career_role_id: row.careerRoleId,
      })),
    );
    if (error) {
      return err(error.code === "23505" ? "Some emails were added by someone else meanwhile. Preview again." : "Something went wrong. Try again.");
    }
  } catch {
    return err("Something went wrong. Try again.");
  }
  revalidatePath("/members");
  return ok({ created: toCreate.length });
}
