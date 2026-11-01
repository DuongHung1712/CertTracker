"use server";

import { revalidatePath } from "next/cache";
import { idSchema, recordSchema, type RecordInput } from "@/features/records/schema";
import { assertAffected } from "@/lib/assert-affected";
import { mapPostgresError } from "@/lib/postgres-error";
import { err, ok, type Result } from "@/lib/result";
import { evidencePath, MAX_EVIDENCE_BYTES, sniffEvidenceType } from "@/lib/storage/evidence";
import { createSupabaseStorage } from "@/lib/storage/supabase-storage";
import { createClient } from "@/lib/supabase/server";

const MESSAGES = {
  duplicate: "This member already has a record for this course. Edit the existing record instead of creating a new one.",
  restricted: "The member or the course no longer exists. Reload the page and try again.",
  invalid: "Status, progress and issue date do not match.",
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
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
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
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
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
  if (!parsed.success) return err("Invalid data");
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

export async function uploadEvidence(formData: FormData): Promise<Result<null>> {
  const parsed = idSchema.safeParse({ id: formData.get("recordId") });
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File)) return err("Invalid data");
  if (file.size === 0) return err("The file is empty.");
  if (file.size > MAX_EVIDENCE_BYTES) return err("The file is larger than 4 MB. Compress it or take the photo again, then retry.");
  const mime = sniffEvidenceType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!mime) return err("Only PDF, JPG, PNG or WebP files are accepted.");

  const supabase = await createClient();
  // The member id comes from the row RLS lets this user see — never from the client — so the
  // object key cannot be pointed at another member's folder.
  const { data: record, error: readError } = await supabase
    .from("training_records")
    .select("id, member_id, evidence_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (readError) return err(mapPostgresError(readError));
  if (!record) return err("Record not found, or you do not have permission.");

  const storage = createSupabaseStorage(supabase);
  const path = evidencePath(record.member_id, record.id, mime, Date.now());
  try {
    await storage.upload(path, file, mime);
  } catch {
    return err("The file could not be uploaded. Check your connection and try again.");
  }

  const { data: rows, error } = await supabase
    .from("training_records")
    .update({ evidence_path: path })
    .eq("id", record.id)
    .select("id");
  const guard = error ? err(mapPostgresError(error)) : assertAffected(rows);
  if (guard) {
    await storage.delete(path).catch(() => undefined); // do not leave the new file orphaned
    return guard;
  }
  if (record.evidence_path) await storage.delete(record.evidence_path).catch(() => undefined);
  revalidate();
  return ok(null);
}

export async function removeEvidence(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data: record, error: readError } = await supabase
    .from("training_records")
    .select("id, evidence_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (readError) return err(mapPostgresError(readError));
  if (!record) return err("Record not found, or you do not have permission.");
  if (!record.evidence_path) return ok(null);

  const { data: rows, error } = await supabase
    .from("training_records")
    .update({ evidence_path: null })
    .eq("id", record.id)
    .select("id");
  if (error) return err(mapPostgresError(error));
  const guard = assertAffected(rows);
  if (guard) return guard;
  await createSupabaseStorage(supabase).delete(record.evidence_path).catch(() => undefined);
  revalidate();
  return ok(null);
}
