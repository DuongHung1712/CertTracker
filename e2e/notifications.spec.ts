import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";
import { isoWeekKey, monthLabel, previousMonthKey, weekLabel } from "../src/features/notifications/period";
import { todayVn } from "../src/lib/dates";
import { signIn } from "./helpers";
import { readLocalEnv } from "./support/env";
import { signInAsSeedUser } from "./support/restore-seed";
import { assertSeedFresh } from "./support/seed-fresh";

// Seed (supabase/seed.sql): Team Cloud = An (AWS done, expires in ~26 days) + Châu; Team AI = Bình. The manager
// manages Team Cloud. The cron routes run against the same local database as the app, with EMAIL_TRANSPORT=console.
const SECRET = readLocalEnv("CRON_SECRET") ?? "";

const MEMBER_CHAU = "5eed0000-0000-0000-0000-00000000b003";
const MEMBER_BINH = "5eed0000-0000-0000-0000-00000000b002";
const COURSE_AWS = "5eed0000-0000-0000-0000-00000000e001";
const COURSE_NVIDIA = "5eed0000-0000-0000-0000-00000000e002";

test.beforeAll(async () => {
  await assertSeedFresh();
  if (SECRET.length < 16) {
    throw new Error("Set CRON_SECRET (≥16 chars) and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the dev server.");
  }
});

type CronSummary = {
  job: string;
  period: string;
  transport: string;
  dryRun: boolean;
  planned: number;
  sent: number;
  skipped: number;
  inFlight: number;
  failed: number;
  truncated: boolean;
  recipients?: { email: string; detail: Record<string, number> }[];
};

type Job = "expiry-alerts" | "monthly-report";

async function callCron(request: APIRequestContext, job: Job, dryRun: boolean): Promise<{ status: number; body: CronSummary }> {
  const response = await request.get(`/api/cron/${job}${dryRun ? "?dryRun=1" : ""}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
    maxRedirects: 0,
  });
  return { status: response.status(), body: (await response.json()) as CronSummary };
}

/** Every real call is preceded by this: the test must never be able to send real mail. Returns the dry-run summary. */
async function dryRunOnConsole(request: APIRequestContext, job: Job): Promise<CronSummary> {
  const { status, body } = await callCron(request, job, true);
  expect(status).toBe(200);
  if (body.transport !== "console") {
    throw new Error("unset RESEND_API_KEY or set EMAIL_TRANSPORT=console in .env.local — refusing to send real mail");
  }
  expect(body.dryRun).toBe(true);
  return body;
}

/** Row that contains every given text. */
function rowWith(scope: Locator, ...texts: (string | RegExp)[]): Locator {
  let row = scope.getByRole("row");
  for (const text of texts) row = row.filter({ hasText: text });
  return row;
}

/** A fresh browser context per role, so cookies never bleed between sign-ins. */
async function signedInPage(browser: Browser, email: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email);
  return { page, close: () => context.close() };
}

test("cron endpoints require the bearer token and are not redirected by the login proxy", async ({ request, browser }) => {
  const unauthenticated = await request.get("/api/cron/expiry-alerts", { maxRedirects: 0 });
  expect(unauthenticated.status()).toBe(401);
  expect(unauthenticated.headers()["content-type"]).toContain("application/json");
  expect(await unauthenticated.json()).toEqual({ error: "unauthorized" });

  const wrongToken = await request.get("/api/cron/expiry-alerts", {
    headers: { Authorization: `Bearer ${"x".repeat(SECRET.length)}` },
    maxRedirects: 0,
  });
  expect(wrongToken.status()).toBe(401);

  const basic = await request.get("/api/cron/monthly-report", {
    headers: { Authorization: `Basic ${Buffer.from(`cron:${SECRET}`).toString("base64")}` },
    maxRedirects: 0,
  });
  expect(basic.status()).toBe(401);

  const post = await request.post("/api/cron/expiry-alerts", {
    headers: { Authorization: `Bearer ${SECRET}` },
    maxRedirects: 0,
  });
  expect(post.status()).toBe(405);

  // A signed-in browser session is not a cron credential: 401 from the route itself, not a redirect to /dashboard.
  const admin = await signedInPage(browser, "admin@certtracker.test");
  try {
    const withCookies = await admin.page.request.get("/api/cron/monthly-report", { maxRedirects: 0 });
    expect(withCookies.status()).toBe(401);
    expect(await withCookies.json()).toEqual({ error: "unauthorized" });
  } finally {
    await admin.close();
  }
});

test("dry runs list the seed's recipients and write nothing to the log", async ({ request, browser }) => {
  const today = todayVn();
  const admin = await signedInPage(browser, "admin@certtracker.test");
  try {
    await admin.page.goto("/settings");
    await expect(admin.page.getByRole("heading", { name: "Cài đặt", level: 1 })).toBeVisible();
    const history = admin.page.getByRole("region", { name: "Lịch sử gửi email", exact: true });
    await expect(history).toBeVisible();
    const rowsBefore = await history.getByRole("row").count();
    const logBefore = await (await signInAsSeedUser("admin@certtracker.test")).from("notification_log").select("id");
    expect(logBefore.error).toBeNull();

    const expiry = await dryRunOnConsole(request, "expiry-alerts");
    expect(expiry.period).toBe(isoWeekKey(today));
    const byEmail = new Map((expiry.recipients ?? []).map((r) => [r.email, r.detail]));
    expect([...byEmail.keys()].sort()).toEqual(["an@certtracker.test", "manager@certtracker.test"]);
    expect(byEmail.get("an@certtracker.test")?.own).toBe(1);
    expect(byEmail.get("manager@certtracker.test")).toMatchObject({ teams: 1, teamItems: 1 });
    expect(expiry.planned).toBe(2);

    const monthly = await dryRunOnConsole(request, "monthly-report");
    expect(monthly.period).toBe(previousMonthKey(today));
    const reportees = (monthly.recipients ?? []).map((r) => r.email);
    expect(reportees).toContain("admin@certtracker.test");
    expect(reportees).toContain("manager@certtracker.test");
    expect(reportees).not.toContain("member@certtracker.test");

    // Dry runs claim nothing: neither the table on /settings nor the log itself grows.
    await admin.page.reload();
    await expect(history).toBeVisible();
    expect(await history.getByRole("row").count()).toBe(rowsBefore);
    const logAfter = await (await signInAsSeedUser("admin@certtracker.test")).from("notification_log").select("id");
    expect(logAfter.error).toBeNull();
    expect(logAfter.data?.length).toBe(logBefore.data?.length);
  } finally {
    await admin.close();
  }
});

test("a real run sends once and a second call sends nothing; /settings shows the history", async ({ request, browser }) => {
  for (const job of ["expiry-alerts", "monthly-report"] as const) {
    const dry = await dryRunOnConsole(request, job);
    expect(dry.planned).toBeGreaterThan(0);

    // The log persists between runs on purpose (reset the DB to clear it), so assert relations, not absolute numbers.
    const first = await callCron(request, job, false);
    expect(first.status).toBe(200);
    expect(first.body.transport).toBe("console");
    expect(first.body.failed).toBe(0);
    expect(first.body.inFlight).toBe(0);
    expect(first.body.sent + first.body.skipped).toBe(first.body.planned);

    const second = await callCron(request, job, false);
    expect(second.status).toBe(200);
    expect(second.body.failed).toBe(0);
    expect(second.body.sent).toBe(0);
    expect(second.body.skipped).toBe(second.body.planned);
    expect(second.body.planned).toBe(first.body.planned);
  }

  const today = todayVn();
  const admin = await signedInPage(browser, "admin@certtracker.test");
  try {
    await admin.page.goto("/settings");
    await expect(admin.page.getByRole("heading", { name: "Cài đặt", level: 1 })).toBeVisible();
    const history = admin.page.getByRole("region", { name: "Lịch sử gửi email", exact: true });

    // Columns: Loại · Kỳ · Đã gửi · Lỗi · Đang gửi · Hoạt động cuối.
    const expiryRow = rowWith(history, "Nhắc hạn chứng chỉ", weekLabel(isoWeekKey(today)));
    await expect(expiryRow).toBeVisible();
    const sent = Number(await expiryRow.getByRole("cell").nth(2).innerText());
    expect(sent).toBeGreaterThanOrEqual(1);
    await expect(expiryRow.getByRole("cell").nth(3)).toHaveText("0");

    const monthlyRow = rowWith(history, "Báo cáo tháng", monthLabel(previousMonthKey(today)));
    await expect(monthlyRow).toBeVisible();
    await expect(monthlyRow.getByRole("cell").nth(3)).toHaveText("0");

    // The configuration block reports presence only; the value of the secret never reaches the page.
    const config = admin.page.getByRole("region", { name: "Cấu hình email", exact: true });
    await expect(config.getByRole("listitem").filter({ hasText: "CRON_SECRET" })).toContainText("Đã cấu hình");
    await expect(admin.page.locator("body")).not.toContainText(SECRET);
  } finally {
    await admin.close();
  }
});

test("data quality shows overdue exams by role", async ({ browser }) => {
  const yesterday = todayVn(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const adminDb = await signInAsSeedUser("admin@certtracker.test");

  // Châu (Team Cloud) and Bình (Team AI) each get an exam planned yesterday; both are removed in `finally`.
  const inserted = await adminDb
    .from("training_records")
    .insert([
      { member_id: MEMBER_CHAU, course_id: COURSE_NVIDIA, status: "not_started", progress: 0, planned_exam_date: yesterday },
      { member_id: MEMBER_BINH, course_id: COURSE_AWS, status: "not_started", progress: 0, planned_exam_date: yesterday },
    ])
    .select("id");
  if (inserted.error || inserted.data?.length !== 2) {
    throw new Error(`Could not create the overdue records: ${inserted.error?.message ?? "unexpected row count"}`);
  }
  const ids = inserted.data.map((r) => r.id);

  try {
    const admin = await signedInPage(browser, "admin@certtracker.test");
    try {
      await admin.page.goto("/data-quality");
      await expect(admin.page.getByRole("heading", { name: "Chất lượng dữ liệu", level: 1 })).toBeVisible();
      const body = admin.page.locator("body");
      await expect(rowWith(body, "Thiếu minh chứng", "Nguyễn Văn An")).toBeVisible();
      await expect(rowWith(body, "Quá hạn thi", "Lê Minh Châu")).toBeVisible();
      await expect(rowWith(body, "Quá hạn thi", "Trần Thị Bình")).toBeVisible();

      await admin.page.getByRole("button", { name: "Quá hạn thi (2)" }).click();
      await expect(admin.page.getByRole("button", { name: "Quá hạn thi (2)" })).toHaveAttribute("aria-pressed", "true");
      await expect(rowWith(body, /Quá hạn thi/)).toHaveCount(2);
      await expect(rowWith(body, /Thiếu minh chứng/)).toHaveCount(0);
    } finally {
      await admin.close();
    }

    const manager = await signedInPage(browser, "manager@certtracker.test");
    try {
      await manager.page.goto("/data-quality");
      await expect(manager.page.getByRole("heading", { name: "Chất lượng dữ liệu", level: 1 })).toBeVisible();
      const body = manager.page.locator("body");
      await expect(rowWith(body, "Thiếu minh chứng", "Nguyễn Văn An")).toBeVisible();
      await expect(rowWith(body, "Quá hạn thi", "Lê Minh Châu")).toBeVisible();
      // Absence is only meaningful once the page has rendered what the manager may see.
      await expect(rowWith(body, /Trần Thị Bình/)).toHaveCount(0);
      await expect(manager.page.getByRole("button", { name: "Quá hạn thi (1)" })).toBeVisible();
      // Member- and course-level findings are for admins only.
      await expect(manager.page.getByRole("button", { name: /^Chưa có team/ })).toHaveCount(0);
      await expect(manager.page.getByRole("button", { name: /^Chưa khai báo thời hạn/ })).toHaveCount(0);
    } finally {
      await manager.close();
    }

    const member = await signedInPage(browser, "member@certtracker.test");
    try {
      const nav = member.page.getByRole("navigation", { name: "Điều hướng chính" });
      await expect(nav.getByRole("link", { name: "Chứng chỉ của tôi" })).toBeVisible();
      await expect(nav.getByRole("link", { name: /^Chất lượng dữ liệu$/ })).toHaveCount(0);
      await member.page.goto("/data-quality");
      await expect(member.page).toHaveURL(/\/me$/);
    } finally {
      await member.close();
    }
  } finally {
    await adminDb.from("training_records").delete().in("id", ids);
    // RLS turns a forbidden delete into a silent no-op, so prove the records are gone.
    const left = await adminDb.from("training_records").select("id").in("id", ids);
    if (left.error || (left.data?.length ?? 0) > 0) {
      throw new Error(`The overdue test records were not removed: ${left.error?.message ?? `${left.data?.length} left`}`);
    }
  }
});

test("settings is for admins only", async ({ browser }) => {
  const manager = await signedInPage(browser, "manager@certtracker.test");
  try {
    const nav = manager.page.getByRole("navigation", { name: "Điều hướng chính" });
    await expect(nav.getByRole("link", { name: "Chất lượng dữ liệu" })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^Cài đặt$/ })).toHaveCount(0);

    await manager.page.goto("/settings");
    await expect(manager.page).toHaveURL(/\/dashboard$/);
    await expect(manager.page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(manager.page.getByRole("heading", { name: /^Cài đặt$/ })).toHaveCount(0);
  } finally {
    await manager.close();
  }
});
