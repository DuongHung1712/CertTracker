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

/** Value of one summary tile on the manager and admin dashboards. */
function summaryValue(page: Page, label: string): Locator {
  return section(page, "Overview")
    .locator("[data-slot=kpi-tile]")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("dd")
    .first();
}

const waitingTile = (page: Page) => section(page, "Overview").getByRole("link", { name: /Waiting for approval/ });

test("admin sees four org-wide tiles, Needs attention, the Explorer and a collapsed ranking", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  // The seed holds one valid exam certificate that expires in ~25 days.
  await expect(waitingTile(page)).toHaveAttribute("href", "/records?approval=waiting");
  await expect(summaryValue(page, "Valid certificates")).toHaveText("1");
  await expect(summaryValue(page, "Expiring in 60 days")).toHaveText("1");
  await expect(summaryValue(page, "Expired")).toHaveText("0");

  // Removed in the distillation: profile, quick actions, planned features, strips, tab strip.
  for (const name of ["Your profile", "Quick actions", "Planned features (Coming soon)", "Certificate expiry"]) {
    await expect(section(page, name)).toHaveCount(0);
  }
  await expect(page.getByRole("tab", { name: /Soon$/ })).toHaveCount(0);

  // Explorer opens on the Team tab; its detail panel and filters stay.
  await expect(rowWith(section(page, "By team"), "Team Cloud")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter by certificate status" })).toContainText("Any status");
  await expect(page.getByRole("combobox", { name: "Filter by number of learning items" })).toContainText("Any number of learning items");
  await expect(page.getByRole("img", { name: /^Done rate:/ })).toBeVisible();
  const detailPanel = page.getByRole("region", { name: "Selected item details" });
  await expect(detailPanel.getByRole("heading", { name: "Team Cloud" })).toBeVisible();

  // The ranking is collapsed until its summary is clicked.
  await page.getByText("Individual ranking", { exact: true }).click();
  const anRow = rowWith(page.getByRole("main"), "Nguyễn Văn An").filter({ hasText: /^1/ });
  await expect(anRow).toBeVisible();
});

test("manager sees four tiles, one Needs attention list and the team table", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");

  // Team Cloud: An's valid AWS expires in ~25 days; Châu has none. Nothing waits for approval at seed.
  await expect(waitingTile(page)).toHaveAttribute("href", "/records?approval=waiting");
  await expect(waitingTile(page).getByText("0", { exact: true })).toBeVisible();
  await expect(summaryValue(page, "Expiring in 60 days")).toHaveText("1");
  await expect(summaryValue(page, "Expired")).toHaveText("0");
  await expect(summaryValue(page, "Valid certificates")).toHaveText("1");

  // Needs attention: An's expiring AWS and Châu, who has no certificate; each row opens that person's learning.
  const attention = section(page, "Needs attention");
  await expect(attention.getByRole("link", { name: new RegExp(`Nguyễn Văn An · ${AWS}`) })).toHaveAttribute("href", /\/records\?search=/);
  await expect(attention.getByRole("link", { name: /Lê Minh Châu/ })).toContainText("No certificate yet");
  await expect(attention.getByRole("link", { name: /Lê Minh Châu/ })).toHaveAttribute("href", /\/members\?search=/);
  // 1 valid of 1 completed (An's AWS); the summary carries the readiness %.
  await expect(page.getByText(/of 1 completed · 100/)).toBeVisible();

  // My team: managed members only (Bình is unmanaged); one team means no Team column and no team filter.
  const team = section(page, "My team");
  await expect(rowWith(team, "Nguyễn Văn An", "Ready")).toBeVisible();
  await expect(rowWith(team, "Lê Minh Châu", "No certificate yet")).toBeVisible();
  await expect(rowWith(team, "Trần Thị Bình")).toHaveCount(0);
  await expect(team.getByRole("columnheader", { name: "Team", exact: true })).toHaveCount(0);
  await expect(rowWith(team, "Nguyễn Văn An").getByRole("link")).toHaveAttribute("href", /\/records\?search=/);

  // Removed: profile, quick actions, Coming soon cards, Soon tabs, readiness league.
  await expect(page.getByRole("tab", { name: /Soon$/ })).toHaveCount(0);
  await expect(page.getByText("(Coming soon)")).toHaveCount(0);
  for (const name of ["Team readiness", "Next to expire", "Automated reminders", "Individual ranking"]) {
    await expect(section(page, name)).toHaveCount(0);
  }
});

test("the manager's team table updates live when a learning item changes elsewhere", async ({ page }) => {
  const CHAU = "5eed0000-0000-0000-0000-00000000b003";
  const admin = await signInAsSeedAdmin();
  await signIn(page, "manager@certtracker.test");
  // Columns without a Team column: Member, Valid, In progress, Expired, Status.
  const inProgress = () => rowWith(section(page, "My team"), "Lê Minh Châu").getByRole("cell").nth(2);
  await expect(inProgress()).toHaveText("0");
  try {
    // Châu starts her self-study AWS item (no course, so an exam in progress).
    const started = await admin.from("learning_items").update({ status: "in_progress", progress: 55 }).eq("member_id", CHAU).select("id");
    if (started.error || started.data.length !== 1) throw new Error(`start Châu's item: ${started.error?.message ?? "not found"}`);
    // No reload on the dashboard: Realtime must trigger the refresh.
    await expect(inProgress()).toHaveText("1", { timeout: 10_000 });
  } finally {
    await restoreSeedLearning(admin);
  }
  await expect(inProgress()).toHaveText("0", { timeout: 10_000 });
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
  const certSection = page.getByRole("region", { name: "My certificates" });
  await expect(certSection).toBeVisible();
  await expect(certSection.getByText("0 exam certificates, 0 course certificates for Lê Minh Châu")).toBeVisible();
  await expect(certSection.getByRole("button", { name: "Add your first certificate" })).toBeVisible();
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

  // Topbar notification contains In-app alerts
  const notifyBtn = page.getByRole("button", { name: "Notifications" });
  await expect(notifyBtn).toBeVisible();
  await notifyBtn.click();
  const certReviewCard = page.getByRole("region", { name: "In-app alerts (Coming soon)" });
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
  await expect(page).toHaveURL(/\/me\?tab=learning&status=not_started$/);
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
