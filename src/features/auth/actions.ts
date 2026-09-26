"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/features/auth/schema";
import { err, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

// Returns `Result | null` so it matches useActionState's `null` initial state.
export async function signIn(_prev: Result<null> | null, formData: FormData): Promise<Result<null> | null> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return err("Email hoặc mật khẩu không đúng");
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
