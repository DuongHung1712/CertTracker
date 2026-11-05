"use server";

import { revalidatePath } from "next/cache";
import {
  careerRoleIdSchema,
  careerRoleSchema,
  careerStartToDate,
  makeCareerStartSchema,
  moveCareerRoleSchema,
  type CareerRoleInput,
  type CareerStartInput,
  type MoveCareerRoleInput,
} from "@/features/career/schema";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const FORBIDDEN_ERROR = "You don't have permission to do this.";
const NOT_FOUND_ERROR = "You don't have permission to do this, or the role no longer exists.";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const INSUFFICIENT_PRIVILEGE = "42501";

type DbError = { code?: string | null; message: string };

/** Never show a raw Postgres error; the few cases a user can fix get their own message. */
function roleError(error: DbError, messages: { duplicate?: string; inUse?: string } = {}): string {
  if (error.code === UNIQUE_VIOLATION) return messages.duplicate ?? GENERIC_ERROR;
  if (error.code === FOREIGN_KEY_VIOLATION) return messages.inUse ?? GENERIC_ERROR;
  if (error.code === INSUFFICIENT_PRIVILEGE) return FORBIDDEN_ERROR;
  return GENERIC_ERROR;
}

function revalidateCareerPages() {
  revalidatePath("/settings");
  revalidatePath("/members");
  revalidatePath("/me");
}

/** A member sets only their own career start, through `set_my_career_start` (the database enforces "own row only"). */
export async function setMyCareerStart(input: CareerStartInput): Promise<Result<null>> {
  const parsed = makeCareerStartSchema(new Date()).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_career_start", { p_start: careerStartToDate(parsed.data) });
  if (error) {
    if (error.message.includes("in the future")) return err("Career start can't be in the future");
    if (error.message.includes("no member profile")) return err("Your account is not linked to a member yet.");
    return err(roleError(error));
  }
  revalidateCareerPages();
  return ok(null);
}

/** Admin only (RLS). The new role goes to the end of the list. */
export async function createCareerRole(input: CareerRoleInput): Promise<Result<null>> {
  const parsed = careerRoleSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { data: last, error: lastError } = await supabase
    .from("career_roles")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) return err(roleError(lastError));
  const { error } = await supabase
    .from("career_roles")
    .insert({ name: parsed.data.name, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) return err(roleError(error, { duplicate: `A role named "${parsed.data.name}" already exists.` }));
  revalidateCareerPages();
  return ok(null);
}

export async function updateCareerRole(input: CareerRoleInput & { id: string }): Promise<Result<null>> {
  const parsed = careerRoleSchema.extend(careerRoleIdSchema.shape).safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const { id, name } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("career_roles").update({ name }).eq("id", id).select("id");
  if (error) return err(roleError(error, { duplicate: `A role named "${name}" already exists.` }));
  if (!data || data.length === 0) return err(NOT_FOUND_ERROR);
  revalidateCareerPages();
  return ok(null);
}

/** Swaps places with the neighbour in one database function (sort_order is unique). Moving past an end does nothing. */
export async function moveCareerRole(input: MoveCareerRoleInput): Promise<Result<null>> {
  const parsed = moveCareerRoleSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_career_role", { p_id: parsed.data.id, p_direction: parsed.data.direction });
  if (error) return err(roleError(error));
  revalidateCareerPages();
  return ok(null);
}

/** A role that members still hold cannot be deleted (`members.career_role_id` is `on delete restrict`). */
export async function deleteCareerRole(input: { id: string }): Promise<Result<null>> {
  const parsed = careerRoleIdSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase.from("career_roles").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(roleError(error, { inUse: "This role is in use" }));
  if (!data || data.length === 0) return err(NOT_FOUND_ERROR);
  revalidateCareerPages();
  return ok(null);
}
