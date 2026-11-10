"use server";

import { revalidatePath } from "next/cache";
import { profileNameSchema } from "@/features/profile/schema";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

/** A user renames only themself, through `set_my_full_name` (the database enforces "own row only"). */
export async function updateMyName(_prev: Result<null> | null, formData: FormData): Promise<Result<null> | null> {
  const parsed = profileNameSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Enter your name");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_full_name", { p_name: parsed.data.fullName });
  if (error) {
    if (error.message.includes("no member profile")) return err("Your account is not linked to a member yet.");
    return err("We could not save your name. Try again.");
  }
  revalidatePath("/profile");
  return ok(null);
}
