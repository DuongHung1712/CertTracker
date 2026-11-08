import { expect, test, type APIRequestContext } from "@playwright/test";
import * as XLSX from "xlsx";
import { buildSampleWorkbook } from "../src/features/import/sample-workbook";
import { todayVn } from "../src/lib/dates";
import { signIn } from "./helpers";
import { readLocalEnv } from "./support/env";
import { createPilotTeams, deleteImportBatch, importRehearsalFile, importWorkbook, sweepRehearsalLeftovers } from "./support/pilot-data";
import { AWS, downloadExport, pilotEmail, removePilotPeople } from "./support/pilot-member";
import { signInAsSeedAdmin } from "./support/restore-seed";

// The DAS pilot's data journeys (spec §7.4 E-8, E-9). The cron routes run against the same local database, with
// EMAIL_TRANSPORT=console and CRON_SECRET passed to the Playwright process (the dev server inherits them).
const VIETNAMESE_NAME = "Nguyễn Thị Hằng";
const UTF8_BOM = [0xef, 0xbb, 0xbf];
const SECRET = readLocalEnv("CRON_SECRET") ?? "";
const CRON_JOBS = ["expiry-alerts", "monthly-report"] as const;
const LOG_KIND = { "expiry-alerts": "expiry-alert", "monthly-report": "monthly-report" } as const;
const REHEARSAL_EMAIL = /^person\d{2}@example\.com$/;
// The seed's AWS course as the catalogue reader would describe it, so the E-8 import creates no catalogue rows.
const SEED_AWS = { name: AWS, validityMonths: 36, provider: "AWS", certType: "Cloud" };

type CronSummary = { period: string; transport: string; planned: number; sent: number; skipped: number; failed: number; recipients?: { email: string }[] };

async function callCron(request: APIRequestContext, job: (typeof CRON_JOBS)[number], dryRun: boolean) {
  const response = await request.get(`/api/cron/${job}${dryRun ? "?dryRun=1" : ""}`, { headers: { Authorization: `Bearer ${SECRET}` } });
  expect(response.status(), job).toBe(200);
  return (await response.json()) as CronSummary;
}

/** The send log's recipients for one job and period, sorted (read as the seed admin, whom RLS lets read it). */
async function loggedRecipients(job: (typeof CRON_JOBS)[number], period: string): Promise<string[]> {
  const admin = await signInAsSeedAdmin();
  const { data, error } = await admin.from("notification_log").select("recipient_email").eq("kind", LOG_KIND[job]).eq("period", period);
  if (error) throw new Error(`read send log: ${error.message}`);
  return data.map((row) => row.recipient_email).sort();
}

test.beforeAll(async () => {
  if (SECRET.length < 16) throw new Error("Pass CRON_SECRET (≥16 chars) in the environment of the Playwright run.");
  await removePilotPeople();
  await sweepRehearsalLeftovers();
});
test.afterAll(removePilotPeople);

test("E-8: an imported Vietnamese name survives /members, the CSV export and the Excel export", async ({ page }) => {
  test.setTimeout(90_000);
  const email = pilotEmail("e8");
  const workbook = buildSampleWorkbook(
    [{ fullName: VIETNAMESE_NAME, email, team: "Team Cloud", certificates: [{ course: AWS, status: "not_started", progress: 0 }] }],
    [SEED_AWS],
    todayVn(),
  );
  await signIn(page, "admin@certtracker.test");
  const batchId = await importWorkbook(page, `pilot-${Date.now()}.xlsx`, workbook);
  try {
    await page.goto("/members");
    await expect(page.getByRole("cell", { name: VIETNAMESE_NAME, exact: true })).toBeVisible();

    const csv = await downloadExport(page, "Export CSV");
    expect([...csv.subarray(0, 3)]).toEqual(UTF8_BOM);
    expect(csv.toString("utf8")).toContain(VIETNAMESE_NAME);

    const book = XLSX.read(await downloadExport(page, "Export Excel"));
    const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]!]!, { header: 1 });
    expect(rows.flat()).toContain(VIETNAMESE_NAME);
  } finally {
    await deleteImportBatch(batchId);
  }
});

test("E-9: after the rehearsal import each cron job mails every recipient once, and a second call sends nothing", async ({ page, request }) => {
  test.setTimeout(180_000);
  const removeTeams = await createPilotTeams();
  try {
    await signIn(page, "admin@certtracker.test");
    const removeRehearsal = await importRehearsalFile(page);
    try {
      for (const job of CRON_JOBS) {
        const dry = await callCron(request, job, true);
        // Never send real mail from a test.
        expect(dry.transport, job).toBe("console");
        const emails = (dry.recipients ?? []).map((recipient) => recipient.email);
        expect(emails.length, job).toBeGreaterThan(0);
        expect(emails.length, `${job}: a recipient is listed twice`).toBe(new Set(emails).size);
        if (job === "expiry-alerts") expect(emails.some((address) => REHEARSAL_EMAIL.test(address))).toBe(true);

        const first = await callCron(request, job, false);
        expect(first.failed, job).toBe(0);
        expect(first.planned, job).toBe(dry.planned);
        expect(first.sent + first.skipped, job).toBe(first.planned);
        // The rehearsal people are new to the log, so the expiry run must really send. The monthly report goes to the
        // seed's admin and manager, whom notifications.spec may already have mailed this month: there the log proves it.
        if (job === "expiry-alerts") expect(first.sent, job).toBeGreaterThan(0);
        const logged = await loggedRecipients(job, dry.period);
        expect(logged.filter((address) => emails.includes(address)), `${job}: one log row per recipient`).toEqual([...emails].sort());

        const second = await callCron(request, job, false);
        expect(second.failed, job).toBe(0);
        expect(second.sent, job).toBe(0);
        expect(second.skipped, job).toBe(second.planned);
        expect(await loggedRecipients(job, dry.period), `${job}: the second run adds no log rows`).toEqual(logged);
      }
    } finally {
      await removeRehearsal();
    }
  } finally {
    await removeTeams();
    // Also clears the rehearsal's rows in the send log.
    await sweepRehearsalLeftovers();
  }
});
