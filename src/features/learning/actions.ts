"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { learningSchema, type LearningInput } from "@/features/learning/schema";
import { assertAffected } from "@/lib/assert-affected";
import { mapPostgresError } from "@/lib/postgres-error";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

const MESSAGES = {
  restricted: "The member, the course or the exam no longer exists. Reload the page and try again.",
  invalid: "Choose a course or an exam, and a finished date that is not in the future for a completed item.",
  duplicate: "This member already has an open item for this exam. Edit that item instead.",
};

function revalidate() {
  revalidatePath("/me");
  revalidatePath("/records");
  revalidatePath("/dashboard");
}

function toRow(data: LearningInput) {
  return {
    course_id: data.courseId,
    target_certificate_id: data.targetCertificateId,
    status: data.status,
    progress: data.status === "done" ? 100 : data.progress,
    planned_date: data.plannedDate,
    finished_date: data.status === "done" ? data.finishedDate : null,
    notes: data.notes,
  };
}

export async function createLearningItem(input: LearningInput): Promise<Result<{ id: string }>> {
  const parsed = learningSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_items")
    .insert({ member_id: parsed.data.memberId, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return err(mapPostgresError(error, MESSAGES));
  revalidate();
  return ok({ id: data.id });
}

/** `member_id` is never updated: an item belongs to one member for life (RLS and a trigger also stop it). */
export async function updateLearningItem(input: LearningInput & { id: string }): Promise<Result<null>> {
  const parsed = learningSchema.safeExtend({ id: z.guid("Invalid data") }).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("learning_items").update(toRow(data)).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, MESSAGES));
  const guard = assertAffected(rows);
  if (guard && !guard.ok) return err(guard.error);
  revalidate();
  return ok(null);
}

const progressSchema = z.object({
  id: z.guid("Invalid data"),
  progress: z.number("Progress must be a number").int("Progress must be a whole number").min(1, "Progress must be at least 1%").max(99, "Progress stops at 99%: mark the item done to finish it"),
});

/**
 * The +10% / +25% buttons on the dashboard. An open item moves to In progress at the new value; it never finishes here,
 * because a finished item needs a date, so 100% goes through the form.
 */
export async function updateLearningProgress(input: { id: string; progress: number }): Promise<Result<null>> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("learning_items")
    .update({ status: "in_progress", progress: parsed.data.progress })
    .eq("id", parsed.data.id)
    .neq("status", "done")
    .select("id");
  if (error) return err(mapPostgresError(error, MESSAGES));
  const guard = assertAffected(rows);
  if (guard && !guard.ok) return err(guard.error);
  revalidate();
  return ok(null);
}

export async function deleteLearningItem(input: { id: string }): Promise<Result<null>> {
  const parsed = z.object({ id: z.guid("Invalid data") }).safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("learning_items").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, MESSAGES));
  const guard = assertAffected(rows);
  if (guard && !guard.ok) return err(guard.error);
  revalidate();
  return ok(null);
}

const proposeCourseSchema = z.object({
  name: z.string().trim().min(1, "Enter the course name").max(200, "The name can have at most 200 characters"),
  proposedProvider: z.string().trim().max(200).nullable(),
  memberId: z.guid("Invalid data").nullable(),
});

/** A missing course: pending until an admin approves it, and usable for tracking right away (decision #72). */
export async function proposeCourse(input: { name: string; proposedProvider: string | null; memberId: string | null }): Promise<Result<{ id: string }>> {
  const parsed = proposeCourseSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      name: parsed.data.name,
      proposed_provider: parsed.data.proposedProvider || null,
      catalogue_status: "pending",
      proposed_by: parsed.data.memberId,
    })
    .select("id")
    .single();
  if (error) return err(mapPostgresError(error, { duplicate: "A course with this name already exists. Pick it from the list." }));
  revalidate();
  return ok({ id: data.id });
}
