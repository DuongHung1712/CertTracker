import type { SupabaseClient } from "@supabase/supabase-js";
import { checkCronAuth } from "@/features/notifications/cron-auth";
import { createLedger, type NotificationLedger } from "@/features/notifications/ledger";
import { runExpiryAlerts, runMonthlyReport, type RunSummary } from "@/features/notifications/run";
import { loadSnapshot } from "@/features/notifications/snapshot";
import type { Snapshot } from "@/features/notifications/types";
import { todayVn } from "@/lib/dates";
import { createEmailSender, EmailConfigError, type EmailSender } from "@/lib/email/sender";
import type { Database } from "@/types/database";

export type CronJob = "expiry-alerts" | "monthly-report";

export type HandlerDeps = {
  /** The service-role client factory. Passed in by the route file, the only place allowed to import it. */
  createClient: () => SupabaseClient<Database>;
  env?: Record<string, string | undefined>;
  now?: () => number;
  loadSnapshot?: (client: SupabaseClient<Database>) => Promise<Snapshot>;
  createLedger?: (client: SupabaseClient<Database>) => NotificationLedger;
  createSender?: (env: Record<string, string | undefined>) => EmailSender;
};

/** Leaves headroom under the route's 60 s `maxDuration` for the last send and the response. */
const BUDGET_MS = 50_000;

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function handleCron(request: Request, job: CronJob, deps: HandlerDeps): Promise<Response> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  // Taken at entry so that loading the snapshot counts against the budget.
  const deadlineMs = now() + BUDGET_MS;

  const auth = checkCronAuth(request.headers.get("authorization"), env.CRON_SECRET);
  if (auth === "misconfigured") return json({ error: "cron-not-configured" }, 500);
  if (auth === "unauthorized") return json({ error: "unauthorized" }, 401);

  if (job !== "expiry-alerts" && job !== "monthly-report") return json({ error: "not-found" }, 404);

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  // Built before anything is claimed, and for dry runs too, so a bad mail configuration shows up immediately.
  let sender: EmailSender;
  try {
    sender = (deps.createSender ?? createEmailSender)(env);
  } catch (e) {
    if (e instanceof EmailConfigError) return json({ error: "email-not-configured", detail: e.message }, 500);
    console.error("cron: could not create the email sender", e);
    return json({ error: "internal" }, 500);
  }

  try {
    // Only now, after authentication, is the service-role client created.
    const client = deps.createClient();
    const run = job === "expiry-alerts" ? runExpiryAlerts : runMonthlyReport;
    const summary: RunSummary = await run({
      snapshot: await (deps.loadSnapshot ?? loadSnapshot)(client),
      today: todayVn(new Date(now())),
      appUrl: env.APP_URL?.replace(/\/+$/, "") || null,
      ledger: (deps.createLedger ?? createLedger)(client),
      sender,
      dryRun,
      now,
      deadlineMs,
    });
    // A non-2xx makes the cron run show up as failed in the Vercel dashboard — the only place an operator looks.
    return json(summary, summary.failed > 0 ? 500 : 200);
  } catch (e) {
    console.error(`cron ${job} failed`, e);
    return json({ error: "internal" }, 500);
  }
}
