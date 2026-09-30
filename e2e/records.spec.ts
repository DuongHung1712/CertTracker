import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Seed rows (supabase/seed.sql): An–AWS done, Bình–NVIDIA in_progress 40, Châu–AWS not_started 0.
const AWS = "AWS Solutions Architect Associate";

/** Row that contains every given text (the row's accessible name is unreliable across columns). */
function recordRow(page: Page, ...texts: string[]): Locator {
  let row = page.getByRole("row");
  for (const text of texts) row = row.filter({ hasText: text });
  return row;
}

/** Opens a searchable combobox in the sheet, types a query and picks the option with `optionName`. */
async function pickOption(page: Page, dialog: Locator, label: string, query: string, optionName: string) {
  await dialog.getByLabel(label, { exact: true }).fill(query);
  // The popup is portalled outside the dialog.
  await page.getByRole("option", { name: optionName }).click();
}

/** Picks a value in a Base UI `Select`; its listbox is portalled outside the dialog. */
async function pickSelect(page: Page, dialog: Locator, label: string, optionName: string) {
  await dialog.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

async function openRowMenu(row: Locator) {
  await row.getByRole("button", { name: /Thao tác/ }).click();
}

/** Admin/manager edit of a record's status + progress through the row menu; waits for the save toast. */
async function editStatus(page: Page, row: Locator, status: string, progress: string) {
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Sửa" }).click();
  const dialog = page.getByRole("dialog");
  await pickSelect(page, dialog, "Trạng thái", status);
  await dialog.getByLabel("Tiến độ (%)").fill(progress);
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã lưu chứng chỉ").first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

test("admin adds a record with evidence, opens it, and deletes it", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Thêm chứng chỉ" }).click();
  const dialog = page.getByRole("dialog");
  // "tran" (no diacritics) must find "Trần Thị Bình".
  await pickOption(page, dialog, "Thành viên", "tran", "Trần Thị Bình");
  await pickOption(page, dialog, "Khóa học", "aws", AWS);
  await pickSelect(page, dialog, "Trạng thái", "Hoàn thành");
  await expect(dialog.getByLabel("Tiến độ (%)")).toHaveValue("100");
  await dialog.getByLabel("Ngày cấp").fill("01/06/2026");
  await dialog.getByLabel("Minh chứng").setInputFiles("e2e/fixtures/evidence.pdf");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm chứng chỉ")).toBeVisible();

  const row = recordRow(page, "Trần Thị Bình", AWS);
  await expect(row).toContainText("Còn hiệu lực");

  try {
    // The evidence upload revalidates the list after the record itself appears, so retry until the link exists.
    const link = page.getByRole("menuitem", { name: "Xem minh chứng" });
    await expect(async () => {
      await openRowMenu(row);
      await expect(link).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/api\/records\/[0-9a-f-]+\/evidence$/);
    const response = await page.request.get(href!, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/storage/v1/object/sign/certificates/");
    await page.keyboard.press("Escape");
  } finally {
    // Always remove the record, even when an assertion above failed, so the run stays re-runnable.
    await page.keyboard.press("Escape");
    await openRowMenu(row);
    await page.getByRole("menuitem", { name: "Xóa" }).click();
    await page.getByRole("button", { name: "Xóa chứng chỉ" }).click();
    // Wait for the toast first: while the confirm dialog is open the page behind it is aria-hidden,
    // so `getByRole("row")` would report zero rows immediately, before the delete has happened.
    await expect(page.getByText("Đã xóa chứng chỉ")).toBeVisible();
    await expect(row).toHaveCount(0);
  }
});

test("a second record for the same member and course is refused", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Thêm chứng chỉ" }).click();
  const dialog = page.getByRole("dialog");
  await pickOption(page, dialog, "Thành viên", "nguyen", "Nguyễn Văn An");
  await pickOption(page, dialog, "Khóa học", "aws", AWS);
  await dialog.getByRole("button", { name: "Lưu" }).click();

  await expect(
    dialog.getByText("Thành viên này đã có bản ghi cho khóa học này. Sửa bản ghi hiện có thay vì tạo mới."),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("status rules are enforced in the form", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Thêm chứng chỉ" }).click();
  const dialog = page.getByRole("dialog");
  // An has no NVIDIA record, so a stray successful save would be visible as a new row (and would fail the count below).
  await pickOption(page, dialog, "Thành viên", "nguyen", "Nguyễn Văn An");
  await pickOption(page, dialog, "Khóa học", "nvidia", "NVIDIA Generative AI LLMs");
  await pickSelect(page, dialog, "Trạng thái", "Hoàn thành");

  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog.getByText("Hoàn thành thì cần ngày cấp")).toBeVisible();

  await dialog.getByLabel("Ngày cấp").fill("31/02/2026");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog.getByText("Ngày cấp không hợp lệ (dd/mm/yyyy)")).toBeVisible();

  await dialog.getByLabel("Ngày cấp").fill("01/01/2099");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog.getByText("Ngày cấp không được ở tương lai")).toBeVisible();

  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(recordRow(page, "Nguyễn Văn An", "NVIDIA Generative AI LLMs")).toHaveCount(0);
});

test("manager sees only the managed team and can only pick managed members", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  await page.goto("/records");

  // The manager manages Team Cloud (An, Châu); Bình is on Team AI (supabase/seed.sql).
  await expect(page.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Lê Minh Châu", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Trần Thị Bình", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Thêm chứng chỉ" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Thành viên", { exact: true }).click();
  await expect(page.getByRole("option", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Lê Minh Châu/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Trần Thị Bình/ })).toHaveCount(0);
  await expect(page.getByRole("option")).toHaveCount(2);
});

test("member updates own progress and cannot see company fields", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);

  const row = recordRow(page, AWS);
  try {
    await openRowMenu(row);
    // Anchor on a visible item first: a count of 0 before the menu has rendered would pass vacuously.
    await expect(page.getByRole("menuitem", { name: "Sửa" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Xóa" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Sửa" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Khóa học", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Đăng ký qua công ty")).toHaveCount(0);
    await expect(dialog.getByLabel("Trạng thái hoàn tiền")).toHaveCount(0);
    await expect(dialog.getByLabel("Thành viên", { exact: true })).toHaveCount(0);

    await pickSelect(page, dialog, "Trạng thái", "Đang học");
    await dialog.getByLabel("Tiến độ (%)").fill("40");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu chứng chỉ").first()).toBeVisible();
    await expect(row).toContainText("40%");
  } finally {
    // Restore the seed state (Chưa bắt đầu / 0) so the suite can run again on the same database.
    await page.keyboard.press("Escape");
    await editStatus(page, row, "Chưa bắt đầu", "0");
    await expect(row).toContainText("0%");
  }
});

test("the list updates live for another user", async ({ browser }) => {
  const managerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  try {
    const managerPage = await managerContext.newPage();
    const adminPage = await adminContext.newPage();
    await signIn(managerPage, "manager@certtracker.test");
    await signIn(adminPage, "admin@certtracker.test");
    await managerPage.goto("/records");
    await adminPage.goto("/records");

    // After Week 4's import spec Châu can have a second record, so pin the row by member and course.
    const managerRow = recordRow(managerPage, "Lê Minh Châu", AWS);
    const adminRow = recordRow(adminPage, "Lê Minh Châu", AWS);
    await expect(managerRow).toContainText("0%");
    await expect(adminRow).toBeVisible();

    try {
      await editStatus(adminPage, adminRow, "Đang học", "55");
      // No reload on the manager page: Realtime must trigger the refresh.
      await expect(managerRow).toContainText("55%", { timeout: 10_000 });
    } finally {
      await adminPage.keyboard.press("Escape");
      await editStatus(adminPage, adminRow, "Chưa bắt đầu", "0");
    }
    await expect(managerRow).toContainText("0%", { timeout: 10_000 });
  } finally {
    await managerContext.close();
    await adminContext.close();
  }
});
