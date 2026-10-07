import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAppUrl } from "@/features/notifications/app-url";
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

  // Only the presence of `dryRun` matters (any value, even empty), so a typo can never turn a dry run into a real
  // send; the reverse is impossible too, because every other key is refused. A real send is a request without
  // parameters, which is exactly what Vercel Cron issues (decisions #44).
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => key !== "dryRun")) return json({ error: "unknown-parameter" }, 400);
  const dryRun = params.has("dryRun");

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
      appUrl: normalizeAppUrl(env.APP_URL),
      ledger: (deps.createLedger ?? createLedger)(client),
      sender,
      dryRun,
      now,
      deadlineMs,
    });
    // One structured line per run for the server log: counts only, never addresses or error texts.
    console.info(
      JSON.stringify({
        event: "cron-run",
        job: summary.job,
        period: summary.period,
        transport: summary.transport,
        dryRun: summary.dryRun,
        planned: summary.planned,
        sent: summary.sent,
        skipped: summary.skipped,
        inFlight: summary.inFlight,
        failed: summary.failed,
        truncated: summary.truncated,
        warnings: summary.warnings.length,
        undeliverable: summary.undeliverable.length,
      }),
    );
    // A non-2xx makes the cron run show up as failed in the Vercel dashboard — the only place an operator looks.
    // `truncated` is red too: part of the recipients were not reached and nobody retries on their own. `inFlight`
    // alone stays 200: another run holds the claim, so there is nothing to retry right now.
    return json(summary, summary.failed > 0 || summary.truncated ? 500 : 200);
  } catch (e) {
    console.error(`cron ${job} failed`, e);
    return json({ error: "internal" }, 500);
  }
}
