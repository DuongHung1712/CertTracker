import { cache } from "react";
import type { Role } from "@/components/status/labels";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  memberId: string | null;
};

/**
 * The signed-in user with their profile, cached per request so every Server
 * Component that reads it (layout, pages) shares one query instead of each
 * re-querying `profiles`.
 *
 * Returns `null` when there is no session. Throws when the profile row
 * itself fails to load (RLS/network error) instead of silently defaulting
 * to "member" — a broken read should surface as an error page, not quietly
 * show an admin the member menu.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, member_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Không tải được hồ sơ người dùng: ${error.message}`);
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile?.role ?? "member",
    memberId: profile?.member_id ?? null,
  };
});
