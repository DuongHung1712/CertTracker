"use server";

import { redirect } from "next/navigation";
import { changePasswordSchema, firstChangePasswordIssue, loginSchema, type ChangePasswordField, setPasswordSchema } from "@/features/auth/schema";
import { safeNextPath } from "@/lib/safe-next-path";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

// Returns `Result | null` so it matches useActionState's `null` initial state.
export async function signIn(_prev: Result<null> | null, formData: FormData): Promise<Result<null> | null> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Enter a valid email and password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return err("Wrong email or password. Check them and try again.");
  }

  // The page the visitor wanted before signing in; re-validated here because the form field is client-controlled.
  redirect(safeNextPath(formData.get("next")) ?? "/dashboard");
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
  const { data: verifyData, error: linkError } = await supabase.auth.verifyOtp({ token_hash: parsed.data.tokenHash, type: parsed.data.type });
  if (linkError) return err(LINK_ERROR);

  const email = verifyData?.user?.email ?? (await supabase.auth.getUser()).data.user?.email ?? "";

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  // verifyOtp already opened a session: close it whether or not the save worked, so nobody stays signed in without a password.
  await supabase.auth.signOut({ scope: "local" });
  // The token is spent by now, so a retry needs a new link.
  if (error) return err("We could not save that password. Ask your admin for a new link, then choose a different one.");

  const emailParam = email ? `&email=${encodeURIComponent(email)}` : "";
  redirect(`/login?passwordSet=1${emailParam}`);
}

export type ChangePasswordState = { ok: true; data: null } | { ok: false; error: string; field?: ChangePasswordField };

const fieldErr = (error: string, field?: ChangePasswordField): ChangePasswordState => ({ ok: false, error, field });

/** Changes the password of the signed-in user after re-checking the current one. Never redirects. */
export async function changePassword(_prev: ChangePasswordState | null, formData: FormData): Promise<ChangePasswordState | null> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const { message, field } = firstChangePasswordIssue(parsed.error);
    return fieldErr(message, field);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return err("Sign in again to change your password.");
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) return fieldErr("The current password is not correct.", "currentPassword");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fieldErr("We could not save that password. Choose a different one.", "password");

  return ok(null);
}
