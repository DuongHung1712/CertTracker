"use server";

import { revalidatePath } from "next/cache";
import { certificateSchema, certificateWithIdSchema, type CertificateInput } from "@/features/certificates/schema";
import { idSchema } from "@/features/courses/schema";
import { assertAffected } from "@/lib/assert-affected";
import { mapPostgresError } from "@/lib/postgres-error";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

const KIND_CHANGE_BLOCKED = "This certificate has records with another course. Change them first.";

function toRow(data: CertificateInput) {
  return {
    kind: data.kind,
    name: data.name,
    cert_type_id: data.certTypeId,
    provider_id: data.providerId,
    level: data.level || null,
    validity_months: data.validityMonths,
    url: data.url,
    course_id: data.courseId,
  };
}

const duplicate = (name: string) =>
  `A certificate named "${name}" already exists for this provider, or this course already grants a completion.`;

export async function createCertificate(input: CertificateInput): Promise<Result<null>> {
  const parsed = certificateSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { error } = await supabase.from("certificates").insert(toRow(parsed.data));
  if (error) return err(mapPostgresError(error, { duplicate: duplicate(parsed.data.name) }));
  revalidatePath("/courses");
  return ok(null);
}

/**
 * Spec Q6: changing the kind must not leave a record with a course the trigger would refuse. To a completion, every
 * record's course studied must be empty or the chosen course; to an exam, a course studied must prepare for it.
 * Returns null when a read fails.
 */
async function kindChangeIsSafe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  data: CertificateInput,
): Promise<boolean | null> {
  const current = await supabase.from("certificates").select("kind").eq("id", id).maybeSingle();
  if (current.error) return null;
  if (!current.data || current.data.kind === data.kind) return true;
  const records = await supabase.from("training_records").select("course_id").eq("certificate_id", id).not("course_id", "is", null);
  if (records.error) return null;
  const studied = [...new Set(records.data.flatMap((r) => (r.course_id ? [r.course_id] : [])))];
  if (studied.length === 0) return true;
  if (data.kind === "completion") return studied.every((courseId) => courseId === data.courseId);
  const preparing = await supabase.from("courses").select("id").in("id", studied).eq("prepares_for_id", id);
  if (preparing.error) return null;
  return preparing.data.length === studied.length;
}

export async function updateCertificate(input: CertificateInput & { id: string }): Promise<Result<null>> {
  const parsed = certificateWithIdSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const safe = await kindChangeIsSafe(supabase, id, data);
  if (safe === null) return err("Something went wrong. Try again.");
  if (!safe) return err(KIND_CHANGE_BLOCKED);
  const { data: rows, error } = await supabase.from("certificates").update(toRow(data)).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: duplicate(data.name) }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/courses");
  revalidatePath("/records");
  return ok(null);
}

export async function deleteCertificate(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase.from("certificates").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, { restricted: "This certificate has records. Delete them first." }));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}
