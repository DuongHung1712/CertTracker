"use server";

import { revalidatePath } from "next/cache";
import { memberSchema, type MemberInput } from "@/features/members/schema";
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
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      team_id: parsed.data.teamId,
      is_active: parsed.data.isActive,
    })
    .eq("id", input.id);
  if (error) return err(mapPostgresError(error, { duplicate: `Email "${parsed.data.email}" đã được dùng.` }));
  revalidatePath("/members");
  return ok(null);
}

/** Admin only. */
export async function deleteMember(input: { id: string }): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("members").delete().eq("id", input.id);
  if (error) {
    return err(mapPostgresError(error, { restricted: "Thành viên đang có chứng chỉ. Xóa các bản ghi chứng chỉ trước." }));
  }
  revalidatePath("/members");
  return ok(null);
}
