import { handleCron } from "@/features/notifications/handler";
import { createAdminClient } from "@/lib/supabase/admin";

// Sending is sequential and paced (Resend: 2 req/s); the handler stops claiming new recipients after 50 s.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron issues GET. Only GET is exported, so any other method gets 405 from Next.
export function GET(request: Request) {
  return handleCron(request, "expiry-alerts", { createClient: createAdminClient });
}
