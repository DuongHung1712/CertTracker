"use server";

import { redirect } from "next/navigation";
import { loginSchema, setPasswordSchema } from "@/features/auth/schema";
import { err, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

// Returns `Result | null` so it matches useActionState's `null` initial state.
export async function signIn(_prev: Result<null> | null, formData: FormData): Promise<Result<null> | null> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Enter a valid e-mail and password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return err("Wrong e-mail or password. Check them and try again.");
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const LINK_ERROR = "This link has expired or was already used. Ask your admin for a new one.";

/**
 * Finishes an invitation or password reset link. The token is verified only here, on submit, not when the page
 * opens, so mail scanners that open links cannot use it up. The user then signs in with the new password.
 */
export async function setPassword(_prev: Result<null> | null, formData: FormData): Promise<Result<null> | null> {
  const parsed = setPasswordSchema.safeParse({
    tokenHash: formData.get("tokenHash"),
    type: formData.get("type"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? LINK_ERROR);

  const supabase = await createClient();
  const { error: linkError } = await supabase.auth.verifyOtp({ token_hash: parsed.data.tokenHash, type: parsed.data.type });
  if (linkError) return err(LINK_ERROR);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  // verifyOtp already opened a session: close it whether or not the save worked, so nobody stays signed in without a password.
  await supabase.auth.signOut({ scope: "local" });
  // The token is spent by now, so a retry needs a new link.
  if (error) return err("We could not save that password. Ask your admin for a new link, then choose a different one.");

  redirect("/login?passwordSet=1");
}
