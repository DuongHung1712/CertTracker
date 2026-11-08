import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "../../src/lib/assert-local-supabase-url";
import { readLocalEnv } from "./env";

/** Service-role client for the Auth admin API only (the Dashboard's invite/recovery and deleting test logins). */
export function adminApi(): SupabaseClient {
  const key = readLocalEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY in .env.local or the environment.");
  const url = readLocalEnv("NEXT_PUBLIC_SUPABASE_URL")!;
  assertLocalSupabaseUrl(url);
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * The invitation (or recovery) link is what the Dashboard e-mails; the admin API builds the same one
 * (supabase/templates/invite.html). Returns the new login's id and the token hash `/set-password` takes.
 */
export async function inviteLink(email: string, type: "invite" | "recovery" = "invite"): Promise<{ userId: string; hash: string }> {
  const { data, error } = await adminApi().auth.admin.generateLink({ type, email });
  if (error) throw new Error(`generate ${type} link: ${error.message}`);
  return { userId: data.user.id, hash: data.properties.hashed_token };
}

export async function deleteAccount(userId: string): Promise<void> {
  const { error } = await adminApi().auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete account ${userId}: ${error.message}`);
}
