import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";
import { signInAsSeedUser } from "./support/restore-seed";
import { assertSeedFresh } from "./support/seed-fresh";

// Seed (supabase/seed.sql): An–AWS done (expires in ~25 days), Bình–NVIDIA in_progress 40, Châu–AWS not_started 0.
// Manager manages Team Cloud (An, Châu). Earlier specs can leave extra members without records, so the members
// tile is asserted `>= 3`; every records-based number is exact.
const AWS = "AWS Solutions Architect Associate";

// The tile numbers below depend on the seed's relative dates (see assertSeedFresh).
test.beforeAll(assertSeedFresh);

/** A named section (`Section` sets `aria-label`). Role queries ignore the hidden duplicate Next streams in dev. */
function section(page: Page, name: string): Locator {
  return page.getByRole("region", { name, exact: true });
}

/** The value of one KPI tile inside the "Overview" `dl`. */
function tileValue(page: Page, label: string): Locator {
  return section(page, "Overview")
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("dd")
    .first();
}

/** Row that contains every given text. */
function rowWith(scope: Locator, ...texts: string[]): Locator {
  let row = scope.getByRole("row");
  for (const text of texts) row = row.filter({ hasText: text });
  return row;
}

async function expectOrgWideTiles(page: Page) {
  await expect(tileValue(page, "Certificate records")).toHaveText("3");
  await expect(tileValue(page, "Completed")).toHaveText("1");
  await expect(tileValue(page, "In progress")).toHaveText("1");
  await expect(tileValue(page, "Valid")).toHaveText("1");
  await expect(tileValue(page, "Expiring (≤ 60 days)")).toHaveText("1");
  await expect(tileValue(page, "Expired")).toHaveText("0");
}

/** Picks a value in a Base UI `Select`; its listbox is portalled outside the dialog. */
async function pickSelect(page: Page, dialog: Locator, label: string, optionName: string) {
  await dialog.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

/** Admin edit of a record's status + progress through the row menu; waits for the save toast. */
async function editStatus(page: Page, row: Locator, status: string, progress: string) {
  await row.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await pickSelect(page, dialog, "Status", status);
  await dialog.getByLabel("Progress (%)").fill(progress);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved certificate").first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

test("admin sees org-wide KPIs, hero mini charts, expiry chart and personal ranking", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  await expectOrgWideTiles(page);
  // Seed has 3 active members; members.spec leaks more (members without records), so never assert equality.
  const members = (await tileValue(page, "Active members").innerText()).replace(/\D/g, "");
  expect(Number(members)).toBeGreaterThanOrEqual(3);

  // Hero KPI cards contain accessible mini charts with role="img"
  await expect(page.getByRole("img", { name: /^Certificate records by group:/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Valid certificates:/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Expiring within 60 days:/ })).toBeVisible();

  // Expired card shows positive empty state when total = 0 (seed has 0)
  const expiredPositive = page.getByRole("img", { name: /^No expired certificates/ });
  await expect(expiredPositive).toBeVisible();

  // Expiry chart sits above explorer with exact aria-label contract
  const chart = section(page, "Certificate expiry").getByRole("img", { name: /^Certificate expiry:/ });
  await expect(chart).toBeVisible();
  // Chart labels are day ranges, distinct from the tile labels; anchored so "…1" does not also match "…10".
  await expect(chart).toHaveAttribute("aria-label", /(: |, )≤ 30 days left 1(,|$)/);
  await expect(chart).toHaveAttribute("aria-label", /(: |, )> 60 days left 0(,|$)/);

  await expect(section(page, "By team")).toBeVisible();
  await expect(rowWith(section(page, "By team"), "Team Cloud")).toBeVisible();

  const ranking = section(page, "Individual ranking");
  await expect(ranking).toBeVisible();
  const anRow = rowWith(ranking, "Nguyễn Văn An");
  await expect(anRow).toBeVisible();
  await expect(anRow.getByRole("cell").first()).toHaveText("1");

  // Study completion split in Explorer detail panel exposes accessible image
  const completionSplit = page.getByRole("img", { name: /^Study completion:/ });
  await expect(completionSplit).toBeVisible();

  // Explorer detail panel is visible for selected row
  const detailPanel = page.getByRole("region", { name: "Selected item details" });
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel.getByRole("heading", { name: "Team Cloud" })).toBeVisible();
});

test("manager sees the same org-wide numbers but a ranking limited to their team", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");

  // Org-wide (3 records), not just the managed team's 2.
  await expect(tileValue(page, "Certificate records")).toHaveText("3");
  await expect(section(page, "By team")).toBeVisible();

  const ranking = section(page, "Individual ranking");
  await expect(rowWith(ranking, "Nguyễn Văn An")).toBeVisible();
  await expect(rowWith(ranking, "Lê Minh Châu")).toBeVisible();
  await expect(rowWith(ranking, "Trần Thị Bình")).toHaveCount(0);
});

test("member sees anonymous aggregates only", async ({ page }) => {
  await signIn(page, "member@certtracker.test");

  await expect(tileValue(page, "Certificate records")).toHaveText("3");
  await expect(page.getByRole("tab", { name: /^By team$/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^By team$/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Individual ranking$/ })).toHaveCount(0);

  await expect(page.getByText("Only groups with at least 3 learners are shown.")).toBeVisible();
  // AWS has 2 learners and NVIDIA 1: every provider group is below the threshold, so none is shown.
  await page.getByRole("tab", { name: "By provider" }).click();
  await expect(section(page, "By provider").getByText("Not enough data to show")).toBeVisible();
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
  expect(Number(kpis.data?.[0].total_records)).toBe(3);

  const manager = await signInAsSeedUser("manager@certtracker.test");
  const managed = await manager.rpc("dashboard_ranking");
  expect(managed.error).toBeNull();
  expect(managed.data?.map((row) => row.full_name).sort()).toEqual(["Lê Minh Châu", "Nguyễn Văn An"]);
});

test("the dashboard updates live when a record changes elsewhere", async ({ browser }) => {
  const viewerContext = await browser.newContext();
  const editorContext = await browser.newContext();
  try {
    const viewer = await viewerContext.newPage();
    const editor = await editorContext.newPage();
    await signIn(viewer, "admin@certtracker.test");
    await signIn(editor, "admin@certtracker.test");
    await editor.goto("/records");

    await expect(tileValue(viewer, "In progress")).toHaveText("1");
    // Pin the row by member and course so the edit never depends on row order.
    const row = rowWith(editor.locator("body"), "Lê Minh Châu", AWS);
    await expect(row).toBeVisible();

    try {
      await editStatus(editor, row, "In progress", "55");
      // No reload on the dashboard: Realtime must trigger the refresh.
      await expect(tileValue(viewer, "In progress")).toHaveText("2", { timeout: 10_000 });
    } finally {
      await editor.keyboard.press("Escape");
      await editStatus(editor, row, "Not started", "0");
    }
    await expect(tileValue(viewer, "In progress")).toHaveText("1", { timeout: 10_000 });
  } finally {
    await viewerContext.close();
    await editorContext.close();
  }
});

test("explorer tabs, filter row, clear filters, and keyboard row selection update detail panel", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  // Switch to "Popular courses" tab
  await page.getByRole("tab", { name: "Popular courses" }).click();
  const courseSection = section(page, "Popular courses");
  await expect(courseSection).toBeVisible();

  // Detail panel reflects default first row (AWS course)
  const detailPanel = page.getByRole("region", { name: "Selected item details" });
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel.getByRole("heading", { name: AWS })).toBeVisible();

  // Filter input searches across courses
  const searchInput = page.getByRole("textbox", { name: "Filter course" });
  await searchInput.fill("NVIDIA");
  await expect(rowWith(courseSection, "NVIDIA")).toBeVisible();
  await expect(courseSection.getByText(AWS)).toHaveCount(0);

  // Active filter chip shows 1
  await expect(page.getByText("Active filters")).toBeVisible();

  // Clear filters button restores all courses
  const clearBtn = page.getByRole("button", { name: "Clear filters" }).first();
  await clearBtn.click();
  await expect(rowWith(courseSection, AWS)).toBeVisible();
  await expect(searchInput).toHaveValue("");

  // Keyboard navigation on rows: focus row and press Enter
  const nvidiaRow = rowWith(courseSection, "NVIDIA");
  await nvidiaRow.focus();
  await page.keyboard.press("Enter");
  await expect(nvidiaRow).toHaveAttribute("aria-selected", "true");
  await expect(detailPanel.getByRole("heading", { name: /NVIDIA/ })).toBeVisible();

  // Filtering that excludes the selected row falls back to first matching row
  await searchInput.fill("AWS");
  await expect(rowWith(courseSection, AWS)).toHaveAttribute("aria-selected", "true");
  await expect(detailPanel.getByRole("heading", { name: AWS })).toBeVisible();
});
