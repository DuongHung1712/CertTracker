import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client: bypasses RLS. ONLY the cron route handlers may import this file (ESLint enforces it;
 * decisions #35). Never reachable from the browser: `server-only` fails the build if a client component pulls it in.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
