"use server";

import { revalidatePath } from "next/cache";
import {
  dcSchema,
  idSchema,
  programSchema,
  removeScopesSchema,
  scopeManagersSchema,
  teamSchema,
  type DcInput,
  type ProgramInput,
  type RemoveScopesInput,
  type ScopeManagersInput,
  type TeamInput,
} from "@/features/organizations/schema";
import { assertAffected } from "@/lib/assert-affected";
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
  const parsed = dcSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("dcs").update(data).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `Trung tâm "${data.name}" đã tồn tại.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/org");
  return ok(null);
}

export async function deleteDc(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase.from("dcs").delete().eq("id", parsed.data.id).select("id");
  if (error) {
    return err(mapPostgresError(error, { restricted: "Trung tâm đang có chương trình. Xóa các chương trình trước." }));
  }
  const guard = assertAffected(data);
  if (guard) return guard;
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
  const parsed = programSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const { id, name, dcId } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("programs")
    .update({ name, dc_id: dcId })
    .eq("id", id)
    .select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `Chương trình "${name}" đã tồn tại trong trung tâm này.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/org");
  return ok(null);
}

export async function deleteProgram(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase.from("programs").delete().eq("id", parsed.data.id).select("id");
  if (error) {
    return err(mapPostgresError(error, { restricted: "Chương trình đang có team. Xóa các team trước." }));
  }
  const guard = assertAffected(data);
  if (guard) return guard;
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
  const parsed = teamSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const { id, name, programId } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("teams")
    .update({ name, program_id: programId })
    .eq("id", id)
    .select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `Team "${name}" đã tồn tại trong chương trình này.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/org");
  return ok(null);
}

/** Deleting a team is never blocked (members.team_id → NULL, manager_scopes cascades) — the ConfirmDialog must say so. */
export async function deleteTeam(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/org");
  return ok(null);
}

const NOT_A_MANAGER_MESSAGE = "scope requires the manager role";

/**
 * Replaces the manager set of one team or program with exactly `userIds` (diff of add/remove against
 * manager_scopes). Only users whose role is "manager" can be added (a DB trigger enforces it).
 */
export async function setScopeManagers(input: ScopeManagersInput): Promise<Result<null>> {
  const parsed = scopeManagersSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const { scope, userIds } = parsed.data;
  const column = scope.kind === "team" ? "team_id" : "program_id";
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("manager_scopes")
    .select("user_id")
    .eq(column, scope.id);
  if (readError) return err(mapPostgresError(readError));

  const currentIds = new Set(current.map((row) => row.user_id));
  const nextIds = new Set(userIds);
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("manager_scopes")
      .insert(
        toAdd.map((userId) =>
          scope.kind === "team" ? { user_id: userId, team_id: scope.id } : { user_id: userId, program_id: scope.id },
        ),
      );
    if (error) {
      if (error.message.includes(NOT_A_MANAGER_MESSAGE)) {
        return err("Only users with the Manager role can manage a team or program.");
      }
      return err(mapPostgresError(error));
    }
  }
  if (toRemove.length > 0) {
    const { data, error } = await supabase
      .from("manager_scopes")
      .delete()
      .eq(column, scope.id)
      .in("user_id", toRemove)
      .select("user_id");
    if (error) return err(mapPostgresError(error));
    const guard = assertAffected(data);
    if (guard) return guard;
  }
  revalidatePath("/org");
  revalidatePath("/members");
  return ok(null);
}

/**
 * Admin only (RLS): deletes every manager scope of one user. Used to clear the inert scopes of a user who is
 * no longer a manager; dialog saves keep those rows so an accidental demotion stays easy to undo.
 */
export async function removeManagerScopes(input: RemoveScopesInput): Promise<Result<null>> {
  const parsed = removeScopesSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manager_scopes")
    .delete()
    .eq("user_id", parsed.data.userId)
    .select("id");
  if (error) return err(mapPostgresError(error));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/members");
  revalidatePath("/org");
  return ok(null);
}
