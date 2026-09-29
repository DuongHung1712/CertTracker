"use server";

import { revalidatePath } from "next/cache";
import { dcSchema, programSchema, teamSchema, type DcInput, type ProgramInput, type TeamInput } from "@/features/organizations/schema";
import { err, ok, type Result } from "@/lib/result";
import { mapPostgresError } from "@/lib/postgres-error";
import { createClient } from "@/lib/supabase/server";

export async function createDc(input: DcInput): Promise<Result<null>> {
  const parsed = dcSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("dcs").insert(parsed.data);
  if (error) return err(mapPostgresError(error, { duplicate: `Trung tâm "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function updateDc(input: DcInput & { id: string }): Promise<Result<null>> {
  const parsed = dcSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("dcs").update(parsed.data).eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Trung tâm "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function deleteDc(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("dcs").delete().eq("id", input.id);
  if (error) {
    return err(mapPostgresError(error, { restricted: "Trung tâm đang có chương trình. Xóa các chương trình trước." }));
  }
  revalidatePath("/org");
  return ok(null);
}

export async function createProgram(input: ProgramInput): Promise<Result<null>> {
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("programs").insert({ name: parsed.data.name, dc_id: parsed.data.dcId });
  if (error) return err(mapPostgresError(error, { duplicate: `Chương trình "${parsed.data.name}" đã tồn tại trong trung tâm này.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function updateProgram(input: ProgramInput & { id: string }): Promise<Result<null>> {
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({ name: parsed.data.name, dc_id: parsed.data.dcId })
    .eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Chương trình "${parsed.data.name}" đã tồn tại trong trung tâm này.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function deleteProgram(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("programs").delete().eq("id", input.id);
  if (error) {
    return err(mapPostgresError(error, { restricted: "Chương trình đang có team. Xóa các team trước." }));
  }
  revalidatePath("/org");
  return ok(null);
}

export async function createTeam(input: TeamInput): Promise<Result<null>> {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({ name: parsed.data.name, program_id: parsed.data.programId });
  if (error) return err(mapPostgresError(error, { duplicate: `Team "${parsed.data.name}" đã tồn tại trong chương trình này.` }));
  revalidatePath("/org");
  return ok(null);
}

export async function updateTeam(input: TeamInput & { id: string }): Promise<Result<null>> {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ name: parsed.data.name, program_id: parsed.data.programId })
    .eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Team "${parsed.data.name}" đã tồn tại trong chương trình này.` }));
  revalidatePath("/org");
  return ok(null);
}

/** Deleting a team is never blocked (members.team_id → NULL, team_managers cascades) — the ConfirmDialog must say so. */
export async function deleteTeam(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").delete().eq("id", input.id);
  if (error) return err(mapPostgresError(error));
  revalidatePath("/org");
  return ok(null);
}

/** Replaces a team's manager set with exactly `userIds` (diff of add/remove against team_managers). */
export async function setTeamManagers(input: { teamId: string; userIds: string[] }): Promise<Result<null>> {
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("team_managers")
    .select("user_id")
    .eq("team_id", input.teamId);
  if (readError) return err(mapPostgresError(readError));

  const currentIds = new Set(current.map((row) => row.user_id));
  const nextIds = new Set(input.userIds);
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("team_managers")
      .insert(toAdd.map((userId) => ({ team_id: input.teamId, user_id: userId })));
    if (error) return err(mapPostgresError(error));
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("team_managers")
      .delete()
      .eq("team_id", input.teamId)
      .in("user_id", toRemove);
    if (error) return err(mapPostgresError(error));
  }
  revalidatePath("/org");
  return ok(null);
}
