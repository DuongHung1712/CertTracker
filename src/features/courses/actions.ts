"use server";

import { revalidatePath } from "next/cache";
import {
  certTypeSchema,
  courseSchema,
  courseWithIdSchema,
  idSchema,
  providerSchema,
  type CertTypeInput,
  type CourseInput,
  type ProviderInput,
} from "@/features/courses/schema";
import { courseWithCompletionSchema, type CourseWithCompletionInput } from "@/features/certificates/schema";
import { assertAffected } from "@/lib/assert-affected";
import { err, ok, type Result } from "@/lib/result";
import { mapPostgresError } from "@/lib/postgres-error";
import { createClient } from "@/lib/supabase/server";

export async function createCertType(input: CertTypeInput): Promise<Result<null>> {
  const parsed = certTypeSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { error } = await supabase.from("cert_types").insert(parsed.data);
  if (error) return err(mapPostgresError(error, { duplicate: `A certificate type named "${parsed.data.name}" already exists.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function updateCertType(input: CertTypeInput & { id: string }): Promise<Result<null>> {
  const parsed = certTypeSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("cert_types").update(data).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `A certificate type named "${data.name}" already exists.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

export async function deleteCertType(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase.from("cert_types").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, { restricted: "Certificates still use this certificate type, so it cannot be deleted." }));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

export async function createProvider(input: ProviderInput): Promise<Result<null>> {
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { error } = await supabase.from("providers").insert(parsed.data);
  if (error) return err(mapPostgresError(error, { duplicate: `A provider named "${parsed.data.name}" already exists.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function updateProvider(input: ProviderInput & { id: string }): Promise<Result<null>> {
  const parsed = providerSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("providers").update(data).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `A provider named "${data.name}" already exists.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

export async function deleteProvider(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase.from("providers").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, { restricted: "Courses or certificates still use this provider, so it cannot be deleted." }));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

function toCourseRow(data: CourseInput) {
  return {
    name: data.name,
    provider_id: data.providerId,
    prepares_for_id: data.preparesForId,
    refundable: data.refundable,
    cost: data.cost,
    cost_currency: data.costCurrency,
    est_hours: data.estHours,
    url: data.url,
    refund_conditions: data.refundConditions,
  };
}

export async function createCourse(input: CourseInput): Promise<Result<null>> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert(toCourseRow(parsed.data));
  if (error) return err(mapPostgresError(error, { duplicate: `A course named "${parsed.data.name}" already exists for this provider.` }));
  revalidatePath("/courses");
  return ok(null);
}

/**
 * A course and the completion it grants in one step. Two statements, not a transaction: if the completion fails the
 * course just created is deleted again, and if that also fails the message names the course left behind.
 */
export async function createCourseWithCompletion(input: CourseWithCompletionInput): Promise<Result<null>> {
  const parsed = courseWithCompletionSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const data = parsed.data;
  const supabase = await createClient();
  const course = await supabase.from("courses").insert(toCourseRow(data)).select("id").single();
  if (course.error) {
    return err(
      mapPostgresError(course.error, {
        duplicate: `A course named "${data.name}" already exists for this provider.`,
        restricted: "The chosen provider or exam no longer exists. Reload the page and choose again.",
      }),
    );
  }
  const completionName = data.completionName ?? data.name;
  const completion = await supabase.from("certificates").insert({
    kind: "completion",
    name: completionName,
    cert_type_id: data.completionCertTypeId,
    provider_id: data.providerId,
    level: null,
    validity_months: null,
    url: data.completionUrl ?? data.url,
    course_id: course.data.id,
  });
  if (completion.error) {
    const message = mapPostgresError(completion.error, {
      duplicate: `A certificate or course completion named "${completionName}" already exists for this provider. Rename the course or give the completion a different name.`,
      restricted: "The chosen type or provider no longer exists. Reload the page and choose again.",
    });
    const cleanup = await supabase.from("courses").delete().eq("id", course.data.id);
    if (cleanup.error) {
      revalidatePath("/courses");
      return err(`The course "${data.name}" was added but its course completion was not, and the course could not be removed. Delete it from the Courses tab, then try again. (${message})`);
    }
    return err(message);
  }
  revalidatePath("/courses");
  revalidatePath("/records");
  return ok(null);
}

export async function updateCourse(input: CourseInput & { id: string }): Promise<Result<null>> {
  const parsed = courseWithIdSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("courses").update(toCourseRow(data)).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `A course named "${data.name}" already exists for this provider.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

/** A foreign-key refusal on a course means a completion it grants: name it so the admin knows what to change. */
async function deleteCourseMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseId: string,
  error: { code?: string | null; message: string },
): Promise<string> {
  if (error.code !== "23503") return mapPostgresError(error);
  const granted = await supabase.from("certificates").select("name").eq("course_id", courseId).maybeSingle();
  if (!granted.data) return mapPostgresError(error);
  return `This course grants the completion ${granted.data.name}. Delete or change that completion first.`;
}

export async function deleteCourse(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(await deleteCourseMessage(supabase, parsed.data.id, error));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}
