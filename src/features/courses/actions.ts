"use server";

import { revalidatePath } from "next/cache";
import {
  certTypeSchema,
  courseSchema,
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
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("cert_types").insert(parsed.data);
  if (error) return err(mapPostgresError(error, { duplicate: `Loại chứng chỉ "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function updateCertType(input: CertTypeInput & { id: string }): Promise<Result<null>> {
  const parsed = certTypeSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("cert_types").update(data).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `Loại chứng chỉ "${data.name}" đã tồn tại.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

export async function deleteCertType(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase.from("cert_types").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, { restricted: "Loại chứng chỉ đang được khóa học sử dụng." }));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

export async function createProvider(input: ProviderInput): Promise<Result<null>> {
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("providers").insert(parsed.data);
  if (error) return err(mapPostgresError(error, { duplicate: `Nhà cung cấp "${parsed.data.name}" đã tồn tại.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function updateProvider(input: ProviderInput & { id: string }): Promise<Result<null>> {
  const parsed = providerSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("providers").update(data).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `Nhà cung cấp "${data.name}" đã tồn tại.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

export async function deleteProvider(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase.from("providers").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, { restricted: "Nhà cung cấp đang được khóa học sử dụng." }));
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
    est_hours: data.estHours,
    url: data.url,
  };
}

export async function createCourse(input: CourseInput): Promise<Result<null>> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert(toCourseRow(parsed.data));
  if (error) return err(mapPostgresError(error, { duplicate: `Khóa học "${parsed.data.name}" đã tồn tại cho nhà cung cấp này.` }));
  revalidatePath("/courses");
  return ok(null);
}

export async function updateCourse(input: CourseInput & { id: string }): Promise<Result<null>> {
  const parsed = courseSchema.extend({ id: idSchema.shape.id }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("courses").update(toCourseRow(data)).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: `Khóa học "${data.name}" đã tồn tại cho nhà cung cấp này.` }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

export async function deleteCourse(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Dữ liệu không hợp lệ");
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, { restricted: "Khóa học đang có người theo học. Không thể xóa." }));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}
