"use server";

import { revalidatePath } from "next/cache";
import { idSchema, recordSchema, type RecordInput } from "@/features/records/schema";
import { assertAffected } from "@/lib/assert-affected";
import { mapPostgresError } from "@/lib/postgres-error";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

const MESSAGES = {
  duplicate: "Thành viên này đã có bản ghi cho khóa học này. Sửa bản ghi hiện có thay vì tạo mới.",
  restricted: "Thành viên hoặc khóa học không còn tồn tại. Tải lại trang rồi thử lại.",
  invalid: "Trạng thái, tiến độ và ngày cấp không khớp nhau.",
};

function revalidate() {
  revalidatePath("/records");
  revalidatePath("/me");
}

/** Columns every role may write. `undefined` values are dropped from the JSON body, so an absent company field is not sent. */
function toRow(data: RecordInput) {
  return {
    course_id: data.courseId,
    status: data.status,
    progress: data.progress,
    planned_exam_date: data.plannedExamDate,
    issued_date: data.issuedDate,
    certificate_url: data.certificateUrl,
    via_company: data.viaCompany,
    refund_status: data.refundStatus,
    notes: data.notes,
  };
}

export async function createRecord(input: RecordInput): Promise<Result<{ id: string }>> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_records")
    .insert({ member_id: parsed.data.memberId, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return err(mapPostgresError(error, MESSAGES));
  revalidate();
  return ok({ id: data.id });
}

/** `member_id` is never updated: a record belongs to one member for life (delete and re-create to move it). */
export async function updateRecord(input: RecordInput & { id: string }): Promise<Result<null>> {
  const parsed = recordSchema.safeExtend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("training_records").update(toRow(data)).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, MESSAGES));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidate();
  return ok(null);
}

export async function deleteRecord(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_records")
    .delete()
    .eq("id", parsed.data.id)
    .select("id, evidence_path");
  if (error) return err(mapPostgresError(error));
  const guard = assertAffected(data);
  if (guard) return guard;
  // Row first, file second: if the file removal fails we leave a private orphan, never a record
  // pointing at a missing file.
  const evidencePath = data?.[0]?.evidence_path;
  if (evidencePath) {
    const { error: removeError } = await supabase.storage.from("certificates").remove([evidencePath]);
    if (removeError) console.error("evidence cleanup failed", removeError.message);
  }
  revalidate();
  return ok(null);
}
