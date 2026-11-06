"use server";

import { revalidatePath } from "next/cache";
import { careerStartToDate } from "@/features/career/schema";
import { getCurrentUser } from "@/features/auth/queries";
import { idSchema, makeMemberSchema, memberAccessSchema, type MemberAccessInput, type MemberInput } from "@/features/members/schema";
import { assertAffected } from "@/lib/assert-affected";
import { err, ok, type Result } from "@/lib/result";
import { mapPostgresError } from "@/lib/postgres-error";
import { createClient } from "@/lib/supabase/server";

/**
 * Career columns to write, only the ones the caller sent: a manager's form sends neither, so nothing career-related
 * reaches the update (the database trigger rejects a manager changing either column anyway).
 */
function careerColumns({ careerRoleId, careerStart }: Pick<MemberInput, "careerRoleId" | "careerStart">) {
  return {
    ...(careerRoleId !== undefined && { career_role_id: careerRoleId }),
    ...(careerStart !== undefined && { career_start: careerStart === null ? null : careerStartToDate(careerStart) }),
  };
}

/** Admin only — RLS has no insert policy for members for Manager (supabase/migrations/20260928000004_rls.sql). */
export async function createMember(input: MemberInput): Promise<Result<null>> {
  const parsed = makeMemberSchema(new Date()).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    team_id: parsed.data.teamId,
    is_active: parsed.data.isActive,
    ...careerColumns(parsed.data),
  });
  if (error) return err(mapPostgresError(error, { duplicate: `The e-mail "${parsed.data.email}" is already in use.` }));
  revalidatePath("/members");
  return ok(null);
}

/** Admin: any member. Manager: members in a team they manage — and `teamId` must stay one of those teams (RLS with-check). */
export async function updateMember(input: MemberInput & { id: string }): Promise<Result<null>> {
  const parsed = makeMemberSchema(new Date()).extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const { id, fullName, email, teamId, isActive } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("members")
    .update({
      full_name: fullName,
      email,
      team_id: teamId,
      is_active: isActive,
      ...careerColumns(parsed.data),
    })
    .eq("id", id)
    .select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `The e-mail "${email}" is already in use.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/members");
  return ok(null);
}

/**
 * Admin only.
 *
 * `training_records.member_id` is `ON DELETE CASCADE`
 * (supabase/migrations/20260928000002_catalog_and_records.sql:36), not
 * restrict, so Postgres never raises 23503 here — deleting a member with
 * records would silently cascade-delete their entire certification history
 * instead of being blocked, contradicting the confirm dialog's promise.
 * Guard it ourselves with a pre-delete count check (a data-integrity check,
 * not an authorization check, so it doesn't duplicate RLS).
 */
export async function deleteMember(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const { id } = parsed.data;
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("training_records")
    .select("id", { count: "exact", head: true })
    .eq("member_id", id);
  if (countError) return err(mapPostgresError(countError));
  if (count && count > 0) {
    return err("This member still has certificates. Delete their certificates first.");
  }

  const { data, error } = await supabase.from("members").delete().eq("id", id).select("id");
  if (error) {
    // Other Postgres errors only — the FK is cascade, so 23503 for the "has records" case can't
    // fire here anymore (the count check above already caught it).
    return err(mapPostgresError(error, { restricted: "This member still has certificates. Delete their certificates first." }));
  }
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/members");
  return ok(null);
}

/**
 * Admin only (RLS on profiles). Changing your own access is refused so the app always keeps the admin who is using
 * it. Manager scopes are kept when someone stops being a manager; they grant nothing until the role comes back.
 */
export async function setMemberAccess(input: MemberAccessInput): Promise<Result<null>> {
  const parsed = memberAccessSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const { userId, role } = parsed.data;
  const user = await getCurrentUser();
  if (user?.id === userId) return err("You can't change your own access. Ask another admin.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ role }).eq("user_id", userId).select("user_id");
  if (error) return err(mapPostgresError(error));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/members");
  revalidatePath("/org");
  return ok(null);
}
