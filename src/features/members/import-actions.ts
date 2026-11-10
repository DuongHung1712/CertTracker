"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/queries";
import { normalizeEmail, type Cell } from "@/features/import/clean";
import { readFirstSheet } from "@/features/import/workbook";
import { planMemberImport, type MemberImportRow } from "@/features/members/import-plan";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

type Plan = { rows: MemberImportRow[]; counts: { create: number; skip: number; error: number } };

const LOAD_ERROR = "Could not read the members. Try again.";

const EMAIL_CHUNK = 100;
// shortcut: stops after 2000 distinct email-like cells; the plan rejects files over 500 rows anyway.
const MAX_LOOKUP_EMAILS = 2000;

/** Only the file's own emails are looked up, so PostgREST's 1000-row cap on a full member list never hides an existing one. */
async function existingEmails(supabase: Awaited<ReturnType<typeof createClient>>, rows: Cell[][]): Promise<string[] | null> {
  const wanted = new Set<string>();
  for (const cell of rows.flat()) {
    const email = normalizeEmail(cell);
    if (email.ok) wanted.add(email.value);
    if (wanted.size >= MAX_LOOKUP_EMAILS) break;
  }
  const list = [...wanted];
  const chunks = Array.from({ length: Math.ceil(list.length / EMAIL_CHUNK) }, (_, i) => list.slice(i * EMAIL_CHUNK, (i + 1) * EMAIL_CHUNK));
  const results = await Promise.all(chunks.map((chunk) => supabase.from("members").select("email").in("email", chunk)));
  if (results.some((result) => result.error)) return null;
  return results.flatMap((result) => result.data?.map((row) => row.email) ?? []);
}

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
    const [memberEmails, teams, careerRoles] = await Promise.all([
      existingEmails(supabase, sheet.value.rows),
      supabase.from("teams").select("id, name"),
      supabase.from("career_roles").select("id, name"),
    ]);
    if (!memberEmails || teams.error || careerRoles.error) return err(LOAD_ERROR);

    const plan = planMemberImport(sheet.value.rows, {
      memberEmails,
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
