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
  if (error) return err(mapPostgresError(error, { restricted: "Courses still use this certificate type, so it cannot be deleted." }));
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
  if (error) return err(mapPostgresError(error, { restricted: "Courses still use this provider, so it cannot be deleted." }));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

function toCourseRow(data: CourseInput) {
  return {
    name: data.name,
    cert_type_id: data.certTypeId,
    provider_id: data.providerId,
    level: data.level || null,
    validity_months: data.validityMonths,
    refundable: data.refundable,
    cost: data.cost,
    cost_currency: data.costCurrency,
    est_hours: data.estHours,
    url: data.url,
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

export async function deleteCourse(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, { restricted: "Someone has a certificate for this course, so it cannot be deleted." }));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}
