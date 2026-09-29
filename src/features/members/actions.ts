"use server";

import { revalidatePath } from "next/cache";
import { idSchema, memberSchema, type MemberInput } from "@/features/members/schema";
import { assertAffected } from "@/lib/assert-affected";
import { err, ok, type Result } from "@/lib/result";
import { mapPostgresError } from "@/lib/postgres-error";
import { createClient } from "@/lib/supabase/server";

/** Admin only — RLS has no insert policy for members for Manager (supabase/migrations/20260928000004_rls.sql). */
export async function createMember(input: MemberInput): Promise<Result<null>> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    team_id: parsed.data.teamId,
    is_active: parsed.data.isActive,
  });
  if (error) return err(mapPostgresError(error, { duplicate: `Email "${parsed.data.email}" đã được dùng.` }));
  revalidatePath("/members");
  return ok(null);
}

/** Admin: any member. Manager: members in a team they manage — and `teamId` must stay one of those teams (RLS with-check). */
export async function updateMember(input: MemberInput & { id: string }): Promise<Result<null>> {
  const parsed = memberSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const { id, fullName, email, teamId, isActive } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("members")
    .update({
      full_name: fullName,
      email,
      team_id: teamId,
      is_active: isActive,
    })
    .eq("id", id)
    .select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `Email "${email}" đã được dùng.` }));
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
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const { id } = parsed.data;
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("training_records")
    .select("id", { count: "exact", head: true })
    .eq("member_id", id);
  if (countError) return err(mapPostgresError(countError));
  if (count && count > 0) {
    return err("Thành viên đang có chứng chỉ. Xóa các bản ghi chứng chỉ trước.");
  }

  const { data, error } = await supabase.from("members").delete().eq("id", id).select("id");
  if (error) {
    // Other Postgres errors only — the FK is cascade, so 23503 for the "has records" case can't
    // fire here anymore (the count check above already caught it).
    return err(mapPostgresError(error, { restricted: "Thành viên đang có chứng chỉ. Xóa các bản ghi chứng chỉ trước." }));
  }
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/members");
  return ok(null);
}
