import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { buildSampleWorkbook } from "../src/features/import/sample-workbook";
import { todayVn } from "../src/lib/dates";
import { signIn } from "./helpers";
import { adminApi } from "./support/accounts";
import { readLocalEnv } from "./support/env";
import { createPilotTeams, deleteImportBatch, importRehearsalFile, importWorkbook, REHEARSAL_EMAIL_LIKE } from "./support/pilot-data";
import { AWS, pilotEmail, removePilotPeople } from "./support/pilot-member";

// The DAS pilot's data journeys (spec §7.4 E-8, E-9). The cron routes run against the same local database, with
// EMAIL_TRANSPORT=console and CRON_SECRET passed to the Playwright process (the dev server inherits them).
const VIETNAMESE_NAME = "Nguyễn Thị Hằng";
const UTF8_BOM = [0xef, 0xbb, 0xbf];
const SECRET = readLocalEnv("CRON_SECRET") ?? "";
const CRON_JOBS = ["expiry-alerts", "monthly-report"] as const;
const REHEARSAL_EMAIL = /^person\d{2}@example\.com$/;
// The seed's AWS course as the catalogue reader would describe it, so the E-8 import creates no catalogue rows.
const SEED_AWS = { name: AWS, validityMonths: 36, provider: "AWS", certType: "Cloud" };

type CronSummary = { transport: string; planned: number; sent: number; skipped: number; failed: number; recipients?: { email: string }[] };

async function callCron(request: APIRequestContext, job: (typeof CRON_JOBS)[number], dryRun: boolean) {
  const response = await request.get(`/api/cron/${job}${dryRun ? "?dryRun=1" : ""}`, { headers: { Authorization: `Bearer ${SECRET}` } });
  expect(response.status(), job).toBe(200);
  return (await response.json()) as CronSummary;
}

async function download(page: Page, linkName: "Export CSV" | "Export Excel"): Promise<Buffer> {
  await page.goto("/records");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: linkName }).click()]);
  return readFile(await file.path());
}

test.beforeAll(async () => {
  if (SECRET.length < 16) throw new Error("Pass CRON_SECRET (≥16 chars) in the environment of the Playwright run.");
  await removePilotPeople();
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

    const csv = await download(page, "Export CSV");
    expect([...csv.subarray(0, 3)]).toEqual(UTF8_BOM);
    expect(csv.toString("utf8")).toContain(VIETNAMESE_NAME);

    const book = XLSX.read(await download(page, "Export Excel"));
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

        const second = await callCron(request, job, false);
        expect(second.failed, job).toBe(0);
        expect(second.sent, job).toBe(0);
        expect(second.skipped, job).toBe(second.planned);
      }
    } finally {
      await removeRehearsal();
      // The send log is admin read-only through RLS; only the rehearsal's own rows are removed, the seed's stay as in notifications.spec.
      const { error } = await adminApi().from("notification_log").delete().like("recipient_email", REHEARSAL_EMAIL_LIKE);
      if (error) throw new Error(`delete rehearsal send log: ${error.message}`);
    }
  } finally {
    await removeTeams();
  }
});
