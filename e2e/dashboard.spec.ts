import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";
import { signInAsSeedUser } from "./support/restore-seed";

// Seed (supabase/seed.sql): An–AWS done (expires in ~25 days), Bình–NVIDIA in_progress 40, Châu–AWS not_started 0.
// Manager manages Team Cloud (An, Châu). Earlier specs can leave extra members without records, so the members
// tile is asserted `>= 3`; every records-based number is exact.
const AWS = "AWS Solutions Architect Associate";

/** A named section (`Section` sets `aria-label`). Role queries ignore the hidden duplicate Next streams in dev. */
function section(page: Page, name: string): Locator {
  return page.getByRole("region", { name, exact: true });
}

/** The value of one KPI tile inside the "Tổng quan" `dl`. */
function tileValue(page: Page, label: string): Locator {
  return section(page, "Tổng quan")
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
  await expect(tileValue(page, "Bản ghi chứng chỉ")).toHaveText("3");
  await expect(tileValue(page, "Hoàn thành")).toHaveText("1");
  await expect(tileValue(page, "Đang học")).toHaveText("1");
  await expect(tileValue(page, "Còn hiệu lực")).toHaveText("1");
  await expect(tileValue(page, "Sắp hết hạn (≤ 60 ngày)")).toHaveText("1");
  await expect(tileValue(page, "Đã hết hạn")).toHaveText("0");
}

/** Picks a value in a Base UI `Select`; its listbox is portalled outside the dialog. */
async function pickSelect(page: Page, dialog: Locator, label: string, optionName: string) {
  await dialog.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

/** Admin edit of a record's status + progress through the row menu; waits for the save toast. */
async function editStatus(page: Page, row: Locator, status: string, progress: string) {
  await row.getByRole("button", { name: /Thao tác/ }).click();
  await page.getByRole("menuitem", { name: "Sửa" }).click();
  const dialog = page.getByRole("dialog");
  await pickSelect(page, dialog, "Trạng thái", status);
  await dialog.getByLabel("Tiến độ (%)").fill(progress);
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu chứng chỉ").first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

test("admin sees org-wide KPIs, the expiry chart and the personal ranking", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  await expectOrgWideTiles(page);
  // Seed has 3 active members; members.spec leaks more (members without records), so never assert equality.
  const members = (await tileValue(page, "Thành viên đang hoạt động").innerText()).replace(/\D/g, "");
  expect(Number(members)).toBeGreaterThanOrEqual(3);

  const chart = section(page, "Hạn chứng chỉ").getByRole("img", { name: /^Hạn chứng chỉ:/ });
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute("aria-label", /Sắp hết hạn 1/);

  await expect(section(page, "Theo team")).toBeVisible();
  await expect(rowWith(section(page, "Theo team"), "Team Cloud")).toBeVisible();

  const ranking = section(page, "Xếp hạng cá nhân");
  await expect(ranking).toBeVisible();
  const anRow = rowWith(ranking, "Nguyễn Văn An");
  await expect(anRow).toBeVisible();
  await expect(anRow.getByRole("cell").first()).toHaveText("1");
});

test("manager sees the same org-wide numbers but a ranking limited to their team", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");

  // Org-wide (3 records), not just the managed team's 2.
  await expect(tileValue(page, "Bản ghi chứng chỉ")).toHaveText("3");

  const ranking = section(page, "Xếp hạng cá nhân");
  await expect(rowWith(ranking, "Nguyễn Văn An")).toBeVisible();
  await expect(rowWith(ranking, "Lê Minh Châu")).toBeVisible();
  await expect(rowWith(ranking, "Trần Thị Bình")).toHaveCount(0);
});

test("member sees anonymous aggregates only", async ({ page }) => {
  await signIn(page, "member@certtracker.test");

  await expect(tileValue(page, "Bản ghi chứng chỉ")).toHaveText("3");
  await expect(page.getByRole("heading", { name: /^Theo team$/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Xếp hạng cá nhân$/ })).toHaveCount(0);

  await expect(page.getByText("Chỉ hiển thị nhóm có từ 3 người học trở lên.")).toBeVisible();
  // AWS has 2 learners and NVIDIA 1: every provider group is below the threshold, so none is shown.
  await expect(section(page, "Theo nhà cung cấp").getByText("Chưa đủ dữ liệu để hiển thị")).toBeVisible();
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

    await expect(tileValue(viewer, "Đang học")).toHaveText("1");
    // After Week 4's import spec Châu can have a second record, so pin the row by member and course.
    const row = rowWith(editor.locator("body"), "Lê Minh Châu", AWS);
    await expect(row).toBeVisible();

    try {
      await editStatus(editor, row, "Đang học", "55");
      // No reload on the dashboard: Realtime must trigger the refresh.
      await expect(tileValue(viewer, "Đang học")).toHaveText("2", { timeout: 10_000 });
    } finally {
      await editor.keyboard.press("Escape");
      await editStatus(editor, row, "Chưa bắt đầu", "0");
    }
    await expect(tileValue(viewer, "Đang học")).toHaveText("1", { timeout: 10_000 });
  } finally {
    await viewerContext.close();
    await editorContext.close();
  }
});
