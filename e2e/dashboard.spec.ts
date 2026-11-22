import { expect, test, type Locator, type Page } from "@playwright/test";
import { ADMIN_EMAIL, signIn } from "./helpers";
import { inviteLink } from "./support/accounts";
import { acceptInvitation, pilotEmail, removePilotPeople } from "./support/pilot-member";
import { restoreSeedLearning, signInAsSeedAdmin, signInAsSeedUser } from "./support/restore-seed";
import { assertSeedFresh } from "./support/seed-fresh";

// Seed (supabase/seed.sql): An–AWS certificate (expires in ~25 days); learning items (decision #72): Bình studies the
// NVIDIA course for its exam (in_progress 40), Châu plans AWS on her own (not_started 0).
// Manager manages Team Cloud (An, Châu). Earlier specs can leave extra members without records, so the members
// tile is asserted `>= 3`; every records-based number is exact.
const AWS = "AWS Solutions Architect Associate";

// The tile numbers below depend on the seed's relative dates (see assertSeedFresh).
test.beforeAll(async () => {
  await assertSeedFresh();
  // Other specs add learning items to seed members; the numbers below count the seed's two.
  await restoreSeedLearning(await signInAsSeedAdmin());
});

/** A named section (`Section` sets `aria-label`). Role queries ignore the hidden duplicate Next streams in dev. */
function section(page: Page, name: string): Locator {
  return page.getByRole("region", { name, exact: true });
}

/** The value of one KPI tile inside a region ("Overview" unless said otherwise). */
function tileValue(page: Page, label: string, region = "Overview"): Locator {
  return section(page, region)
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("dd")
    .first();
}

/** Row that contains every given text. */
function rowWith(scope: Locator, ...texts: string[]): Locator {
  let row = scope.getByRole("option").or(scope.getByRole("row"));
  for (const text of texts) row = row.filter({ hasText: text });
  return row;
}

async function expectOrgWideTiles(page: Page) {
  // The seed holds one exam certificate. Bình's in-progress item has a course, so it counts as a completion in
  // progress (spec 2026-11-20 §5.3), not as an exam in progress.
  await expect(tileValue(page, "Completed")).toHaveText("1");
  await expect(tileValue(page, "In progress")).toHaveText("0");
  await expect(tileValue(page, "Valid")).toHaveText("1");
  await expect(tileValue(page, "Expiring within 60 days")).toHaveText("1");
  await expect(tileValue(page, "Expired")).toHaveText("0");
  await expect(tileValue(page, "Completions in progress")).toHaveText("1");
  await expect(tileValue(page, "Completed, all time")).toHaveText("0");
  await expect(tileValue(page, "Planned exams")).toHaveText(/^\d+$/);
  await expect(tileValue(page, "Completed this month")).toHaveText("0");
}

test("admin sees org-wide KPIs, hero mini charts, expiry chart and personal ranking", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  await expectOrgWideTiles(page);
  // Seed has 3 active members; members.spec leaks more (members without records), so never assert equality.
  const members = (await tileValue(page, "Active members").innerText()).replace(/\D/g, "");
  expect(Number(members)).toBeGreaterThanOrEqual(3);

  // Hero KPI cards contain accessible mini charts with role="img"
  await expect(page.getByRole("img", { name: /^Certificates by team:/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Valid certificates:/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Expiring within 60 days:/ })).toBeVisible();

  // Expired card shows positive empty state when total = 0 (seed has 0)
  const expiredPositive = page.getByRole("img", { name: /^No expired certificates/ });
  await expect(expiredPositive).toBeVisible();

  // Expiry chart sits above explorer with exact aria-label contract
  const chart = section(page, "Certificate expiry").getByRole("img", { name: /^Certificate expiry:/ });
  await expect(chart).toBeVisible();
  // Chart labels are day ranges, distinct from the tile labels; anchored so "…1" does not also match "…10".
  await expect(chart).toHaveAttribute("aria-label", /(: |, )Expires within 30 days 1(,|$)/);
  await expect(chart).toHaveAttribute("aria-label", /(: |, )More than 60 days 0(,|$)/);

  await expect(section(page, "By team")).toBeVisible();
  await expect(rowWith(section(page, "By team"), "Team Cloud")).toBeVisible();

  const ranking = section(page, "Individual ranking");
  await expect(ranking).toBeVisible();
  const anRow = rowWith(ranking, "Nguyễn Văn An");
  await expect(anRow).toBeVisible();
  await expect(anRow.getByRole("cell").first()).toHaveText("1");

  // Filter selects display human-readable labels, not raw values ("all", "0")
  await expect(page.getByRole("combobox", { name: "Filter by certificate status" })).toContainText("Any status");
  await expect(page.getByRole("combobox", { name: "Filter by number of learning items" })).toContainText("Any number of learning items");

  // Study completion split in Explorer detail panel exposes accessible image
  const completionSplit = page.getByRole("img", { name: /^Done rate:/ });
  await expect(completionSplit).toBeVisible();

  // Explorer detail panel is visible for selected row
  const detailPanel = page.getByRole("region", { name: "Selected item details" });
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel.getByRole("heading", { name: "Team Cloud" })).toBeVisible();
});

test("manager sees team-scoped numbers and no separate ranking", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");

  // Scoped team KPI numbers: Team Cloud has 1 completed valid cert (expires in ~25 days) and 1 not_started cert.
  // Valid share of completed = 100%, Expiring = 1, Expired = 0. Nothing waits for approval at seed.
  await expect(tileValue(page, "Team readiness", "Readiness summary")).toHaveText("100%");
  await expect(tileValue(page, "Expiring within 60 days")).toHaveText("1");
  await expect(tileValue(page, "Expired")).toHaveText("0");
  await expect(page.getByRole("link", { name: /Waiting for approval/ })).toContainText("0");

  // No department-wide totals for a manager: the "Across the department" card was removed.
  await expect(page.getByText("Across the department")).toHaveCount(0);
  await expect(page.getByText("Totals for the whole department.")).toHaveCount(0);

  // The Team readiness list is the only ranking: managed members (An, Châu) only, unmanaged Bình excluded.
  await expect(section(page, "Individual ranking")).toHaveCount(0);
  const readiness = section(page, "Team readiness");
  await expect(rowWith(readiness, "Nguyễn Văn An")).toBeVisible();
  await expect(rowWith(readiness, "Lê Minh Châu")).toBeVisible();
  await expect(rowWith(readiness, "Trần Thị Bình")).toHaveCount(0);
});

test("manager next-to-expire displays urgent renewals ordered soonest first", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");

  const nextSection = section(page, "Next to expire");
  await expect(nextSection).toBeVisible();
  await expect(rowWith(nextSection, "Nguyễn Văn An", AWS)).toBeVisible();
  await expect(nextSection.getByRole("link", { name: "View" })).toHaveAttribute("href", /\/records\?search=/);

  // Needs attention lists expired certificates only; the seed has none, so An's AWS is not listed twice.
  const attention = section(page, "Needs attention");
  await expect(attention).toBeVisible();
  await expect(attention.getByText(AWS)).toHaveCount(0);
  await expect(attention.getByText("Nothing needs attention")).toBeVisible();
});

test("manager team readiness list displays member status breakdown numbers", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");

  const readinessSection = section(page, "Team readiness");
  await expect(readinessSection).toBeVisible();
  await expect(rowWith(readinessSection, "Nguyễn Văn An", "1 valid")).toBeVisible();
  await expect(rowWith(readinessSection, "Lê Minh Châu", "0 valid")).toBeVisible();
  await expect(readinessSection.getByRole("link", { name: "View member certificates" })).toHaveAttribute(
    "href",
    /\/records\?search=/,
  );
});

test("manager sees later modules once, as disabled tabs and one Coming soon card, with no mock data", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");

  // Tab strip: Goals and Skills are the later modules; Approvals is live (WBS 15.4), so it is no placeholder.
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Approvals Soon" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Goals Soon" })).toBeDisabled();
  await expect(page.getByRole("tab", { name: "Skills Soon" })).toBeDisabled();

  // The three bottom Coming soon cards and the separate Risk alerts card are gone.
  for (const name of ["Approvals queue", "Goals", "Skills", "Risk alerts"]) {
    await expect(page.getByRole("region", { name: `${name} (Coming soon)` })).toHaveCount(0);
  }

  // One merged card, no controls.
  const askCard = page.getByRole("region", { name: "Ask about my team (Coming soon)" });
  await expect(askCard).toBeVisible();
  await expect(askCard.getByText(/Not available yet\.$/)).toBeVisible();
  await expect(askCard.getByRole("button")).toHaveCount(0);
  await expect(askCard.getByRole("textbox")).toHaveCount(0);

  // Automated reminders: the two scheduled facts only.
  const reminders = section(page, "Automated reminders");
  await expect(reminders.getByText("Members get an expiry email every Monday at 08:00 (Vietnam time).")).toBeVisible();
  await expect(reminders.getByText("The monthly report goes out on the 1st of each month.")).toBeVisible();
  await expect(reminders.getByRole("link")).toHaveCount(0);

  // No invented values or dead actions anywhere on the page.
  const main = page.getByRole("main");
  for (const fake of [
    /DAS/, // case-sensitive: a plain "DAS" text match would also hit the "Dashboard" heading
    "+28%",
    "Last sent",
    "Joined",
    "Send reminder",
    "Notify member",
    "Remediate",
    "Suggest certification",
    "Assign goal",
    "Open queue",
  ]) {
    await expect(main.getByText(fake)).toHaveCount(0);
  }
  for (const label of ["Month", "Quarter", "Year"]) {
    await expect(main.getByRole("button", { name: label, exact: true })).toHaveCount(0);
  }
});

test("a manager with no teams sees the empty state", async ({ page }) => {
  const admin = await signInAsSeedAdmin();
  await admin.from("manager_scopes").delete().eq("user_id", "5eed0000-0000-0000-0000-00000000f00b");
  try {
    await signIn(page, "manager@certtracker.test");
    await expect(page.getByText("No teams assigned yet", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Ask an admin to assign you as a manager to a team or program so your team's certificates show here."),
    ).toBeVisible();
  } finally {
    const cleanupAdmin = await signInAsSeedAdmin();
    await cleanupAdmin.from("manager_scopes").insert({
      user_id: "5eed0000-0000-0000-0000-00000000f00b",
      team_id: "5eed0000-0000-0000-0000-00000000a001",
    });
  }
});

test("member sees anonymous aggregates only", async ({ page }) => {
  await signIn(page, "member@certtracker.test");

  // Personal KPI cards match the seed member: no certificate, one not-started learning item (Lê Minh Châu)
  await expect(tileValue(page, "Valid")).toHaveText("0");
  await expect(tileValue(page, "Needs action")).toHaveText("0");
  await expect(tileValue(page, "In progress")).toHaveText("0");
  await expect(tileValue(page, "Up next")).toHaveText("1");

  // No department-wide totals for a member: the "Across the department" card was removed.
  await expect(page.getByText("Across the department")).toHaveCount(0);
  await expect(page.getByText("Totals for the whole department.")).toHaveCount(0);
  await expect(page.getByText(/groups with fewer than 3/i)).toHaveCount(0);

  // No ranking and no "By team"
  await expect(page.getByRole("tab", { name: /^By team$/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^By team$/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Individual ranking$/ })).toHaveCount(0);

  // The certificates list holds results only (decision #72): the planned AWS exam is a learning item, not listed here.
  const certSection = page.getByRole("region", { name: "My learning" });
  await expect(certSection).toBeVisible();
  await expect(certSection.getByText("0 exam certificates, 0 course completions for Lê Minh Châu")).toBeVisible();
  await expect(certSection.getByRole("button", { name: "Add your first certificate or course completion" })).toBeVisible();
  await expect(certSection.getByRole("heading", { name: AWS })).toHaveCount(0);

  // Attention banner is hidden when nothing expires within 60 days
  await expect(page.getByRole("complementary", { name: "Certificate attention required" })).toHaveCount(0);

  // Focus area (with integrated next career role) is visible and non-interactive
  const focusCard = page.getByRole("region", { name: "Focus area (Coming soon)" });
  await expect(focusCard).toBeVisible();
  await expect(focusCard).toContainText("Pick the area you want to grow in");

  // Sidebar navigation has My skills and Quarterly goals
  await expect(page.getByRole("link", { name: "My skills" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quarterly goals" })).toBeVisible();

  // Topbar notification contains Certificate review
  const notifyBtn = page.getByRole("button", { name: "Notifications" });
  await expect(notifyBtn).toBeVisible();
  await notifyBtn.click();
  const certReviewCard = page.getByRole("region", { name: "Certificate review (Coming soon)" });
  await expect(certReviewCard).toBeVisible();
  await page.keyboard.press("Escape");

  // Floating chatbot widget for Ask about certificates
  const chatFab = page.getByRole("button", { name: "Ask about certificates" });
  await expect(chatFab).toBeVisible();
  await chatFab.click();
  const chatWidget = page.getByRole("region", { name: "Ask about certificates (Coming soon)" });
  await expect(chatWidget).toBeVisible();
  await expect(chatWidget.getByRole("textbox", { name: "Your question" })).toBeDisabled();
});

test("a member's tiles open My learning narrowed to their items", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  const overview = section(page, "Overview");

  // The seed member has one not-started exam, a learning item, and no certificate.
  await overview.getByRole("link", { name: "Up next", exact: true }).click();
  await expect(page).toHaveURL(/\/me\?tab=learning$/);
  await expect(page.getByRole("tab", { name: /^Learning/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("row").filter({ hasText: "AWS Solutions Architect Associate" })).toHaveCount(1);

  await page.goto("/me?view=held");
  await expect(page.getByText("Showing Valid only")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "AWS Solutions Architect Associate" })).toHaveCount(0);

  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page.getByText("Showing Valid only")).toHaveCount(0);

  // An unknown view is ignored.
  await page.goto("/me?view=nonsense");
  await expect(page.getByText(/^Showing .* only$/)).toHaveCount(0);
});

test("unlinked member account shows guidance empty state on dashboard", async ({ page }) => {
  const email = pilotEmail("dash-unlinked");
  const { hash } = await inviteLink(email);
  try {
    await acceptInvitation(page, email, hash);
    await expect(page.getByText("Your account is not linked to a member")).toBeVisible();
    await expect(page.getByText("Ask your admin to link your account to a member")).toBeVisible();
  } finally {
    await removePilotPeople();
  }
});

test("a member cannot read the ranking or per-team numbers straight from the API", async () => {
  // Real RPC calls with the user's own session (anon key + password sign-in), the same access a browser has.
  const member = await signInAsSeedUser("member@certtracker.test");

  const ranking = await member.rpc("dashboard_ranking");
  expect(ranking.error?.code).toBe("42501");
  expect(ranking.data).toBeNull();

  const teams = await member.rpc("dashboard_breakdown", { p_dimension: "team" });
  expect(teams.error).toBeNull();
  expect(teams.data).toEqual([]);

  const kpis = await member.rpc("dashboard_kpis");
  expect(kpis.error).toBeNull();
  expect(kpis.data).toHaveLength(1);
  // Certificates only (approved results): An's AWS.
  expect(Number(kpis.data?.[0].total_records)).toBe(1);

  const manager = await signInAsSeedUser("manager@certtracker.test");
  const managed = await manager.rpc("dashboard_ranking");
  expect(managed.error).toBeNull();
  expect(managed.data?.map((row) => row.full_name).sort()).toEqual(["Lê Minh Châu", "Nguyễn Văn An"]);
});

test("the dashboard updates live when a learning item changes elsewhere", async ({ page }) => {
  const CHAU = "5eed0000-0000-0000-0000-00000000b003";
  const admin = await signInAsSeedAdmin();
  await signIn(page, "admin@certtracker.test");
  await expect(tileValue(page, "In progress")).toHaveText("0");
  try {
    // Châu starts her self-study AWS item (no course, so an exam in progress).
    const started = await admin.from("learning_items").update({ status: "in_progress", progress: 55 }).eq("member_id", CHAU).select("id");
    if (started.error || started.data.length !== 1) throw new Error(`start Châu's item: ${started.error?.message ?? "not found"}`);
    // No reload on the dashboard: Realtime must trigger the refresh.
    await expect(tileValue(page, "In progress")).toHaveText("1", { timeout: 10_000 });
  } finally {
    await restoreSeedLearning(admin);
  }
  await expect(tileValue(page, "In progress")).toHaveText("0", { timeout: 10_000 });
});

test("explorer tabs, filter row, clear filters, and keyboard row selection update detail panel", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  // Switch to "Popular certificates" tab
  await page.getByRole("tab", { name: "Popular certificates" }).click();
  const certificateSection = section(page, "Popular certificates");
  await expect(certificateSection).toBeVisible();

  // Detail panel reflects default first row (AWS certificate)
  const detailPanel = page.getByRole("region", { name: "Selected item details" });
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel.getByRole("heading", { name: AWS })).toBeVisible();

  // Filter input searches across certificates
  const searchInput = page.getByRole("textbox", { name: "Filter certificate" });
  await searchInput.fill("NVIDIA");
  await expect(rowWith(certificateSection, "NVIDIA")).toBeVisible();
  await expect(certificateSection.getByText(AWS)).toHaveCount(0);

  // Active filter chip shows 1
  await expect(page.getByText("Active filters")).toBeVisible();

  // Clear filters button restores all certificates
  const clearBtn = page.getByRole("button", { name: "Clear filters" }).first();
  await clearBtn.click();
  await expect(rowWith(certificateSection, AWS)).toBeVisible();
  await expect(searchInput).toHaveValue("");

  // Keyboard navigation on rows: focus row and press Enter
  const nvidiaRow = rowWith(certificateSection, "NVIDIA");
  await nvidiaRow.focus();
  await page.keyboard.press("Enter");
  await expect(nvidiaRow).toHaveAttribute("aria-selected", "true");
  await expect(detailPanel.getByRole("heading", { name: /NVIDIA/ })).toBeVisible();

  // Filtering that excludes the selected row falls back to first matching row
  await searchInput.fill("AWS");
  await expect(rowWith(certificateSection, AWS)).toHaveAttribute("aria-selected", "true");
  await expect(detailPanel.getByRole("heading", { name: AWS })).toBeVisible();
});

test("admin Needs attention lists only real items computed from seed data", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  const attention = section(page, "Needs attention");
  await expect(attention).toBeVisible();

  // In seed: An's AWS certificate expires in ~25 days (within 30 days)
  await expect(attention.getByText("Nguyễn Văn An · AWS Solutions Architect Associate")).toBeVisible();
  await expect(attention.getByText(/Expires in \d+ days/)).toBeVisible();

  // In seed: 1 data quality issue (done record without evidence). A member proposal that waits for approval is one more.
  await expect(attention.getByText("Data quality", { exact: true })).toBeVisible();
  await expect(attention.getByText(/^\d+ issues? to check$/)).toBeVisible();
  await expect(attention.getByText("All clear")).toHaveCount(0);

  // No mock/fake strings from Figma
  for (const fake of ["Send reminder", "HRIS sync", "Review submissions", "4 pending proofs", "Minh Pham", "PMP"]) {
    await expect(attention.getByText(fake)).toHaveCount(0);
  }
});

test("admin merged Coming soon card has no interactive controls", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);

  const planned = [
    "Goals",
    "Skills",
    "Focus area",
    "Ask about certificates",
    "Monthly summary",
    "Risk alerts",
  ];
  const card = section(page, "Planned features (Coming soon)");
  await expect(card).toBeVisible();
  for (const title of planned) {
    await expect(card.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }

  // Every planned feature ends with "Not available yet."; nothing else on the page says it.
  await expect(card.getByText(/Not available yet\.$/)).toHaveCount(planned.length);
  await expect(page.getByRole("main").getByText(/Not available yet\./)).toHaveCount(planned.length);

  // No buttons or textboxes
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("textbox")).toHaveCount(0);
});

test("admin profile card renders correctly for admin without a member record", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  const profile = section(page, "Your profile");
  await expect(profile).toBeVisible();
  await expect(profile.getByText("admin@certtracker.test")).toBeVisible();
  await expect(profile.getByText("Admin", { exact: true })).toBeVisible();
  await expect(profile.getByText("Not linked to a member")).toBeVisible();
  await expect(profile.getByText("System administrator")).toHaveCount(0);
  await expect(profile.getByText("Role not set")).toHaveCount(0);

  // No fake badges from Figma
  for (const fake of ["DC34", "Lead Auditor", "AUDIT READY"]) {
    await expect(profile.getByText(fake)).toHaveCount(0);
  }
});

test("admin header and Quick actions offer each action once, with plain names", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  const main = page.getByRole("main");

  const quick = section(page, "Quick actions");
  await expect(quick.getByRole("link")).toHaveText(["Add learning", "Add member", "Import from Excel"]);
  await expect(quick.getByRole("link", { name: "Add member" })).toHaveAttribute("href", "/members");

  await expect(main.getByRole("link", { name: "Add learning" })).toHaveCount(1);
  await expect(main.getByRole("link", { name: "Export CSV" })).toHaveCount(1);
  await expect(main.getByText("Download data")).toHaveCount(0);
  await expect(main.getByText(/Invite/)).toHaveCount(0);

  // The header button moves focus to the Explorer group filters.
  await expect(main.getByRole("button", { name: "Filters", exact: true })).toHaveCount(0);
  await main.getByRole("button", { name: /^Filter groups/ }).click();
  await expect(page.locator("#explorer-search-input")).toBeFocused();
});

for (const [role, email] of [
  ["admin", ADMIN_EMAIL],
  ["manager", "manager@certtracker.test"],
] as const) {
  test(`the ${role} dashboard does not scroll horizontally on a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, email);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

for (const who of ["manager", "admin"]) {
  test(`${who} dashboard has no page-level horizontal scroll at 1024 px`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await signIn(page, `${who}@certtracker.test`);
    await page.waitForLoadState("networkidle");
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll).toBeLessThanOrEqual(client);
  });
}
