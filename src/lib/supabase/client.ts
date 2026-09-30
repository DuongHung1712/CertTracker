import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** Browser client acting as the signed-in user (RLS applies). Only for Realtime — reads and writes stay on the server. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
