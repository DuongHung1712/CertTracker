import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin creates and deletes a member", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members");

  const email = `e2e-${Date.now()}@certtracker.test`;
  await page.getByRole("button", { name: "Thêm thành viên" }).click();
  // Scoped to the dialog: the table's FilterBar search box has aria-label "Tìm theo tên, mã, email…",
  // whose substring match on "Email" collides with the dialog's own field under an unscoped getByLabel.
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Họ tên").fill("Người Dùng E2E");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Team").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("cell", { name: email })).toBeVisible();

  await page.getByRole("row", { name: new RegExp(email) }).getByRole("button", { name: /Thao tác/ }).click();
  await page.getByRole("menuitem", { name: "Xóa" }).click();
  await page.getByRole("button", { name: "Xóa thành viên" }).click();
  await expect(page.getByRole("cell", { name: email })).toHaveCount(0);
});

test("admin cannot delete a member who has training records", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members");

  // Seed member "Nguyễn Văn An" (5eed0000-0000-0000-0000-00000000b001) has a training_records
  // row (supabase/seed.sql) — the delete must be blocked by deleteMember's count guard, not
  // silently cascade-delete their certification history.
  await page
    .getByRole("row", { name: /Nguyễn Văn An/ })
    .getByRole("button", { name: /Thao tác/ })
    .click();
  await page.getByRole("menuitem", { name: "Xóa" }).click();
  await page.getByRole("button", { name: "Xóa thành viên" }).click();
  await expect(page.getByText("Thành viên đang có chứng chỉ. Xóa các bản ghi chứng chỉ trước.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toBeVisible();
});

test("manager cannot create or delete members, and only sees their managed team", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  await page.goto("/members");
  await expect(page.getByRole("button", { name: "Thêm thành viên" })).toHaveCount(0);

  // manager@certtracker.test manages Team Cloud (5eed0000-0000-0000-0000-00000000a001, per
  // supabase/seed.sql's team_managers row). An is on Team Cloud; Bình is on Team AI, unmanaged.
  await expect(page.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Trần Thị Bình", exact: true })).toHaveCount(0);

  await page
    .getByRole("row", { name: /Nguyễn Văn An/ })
    .getByRole("button", { name: /Thao tác/ })
    .click();
  await expect(page.getByRole("menuitem", { name: "Xóa" })).toHaveCount(0);
});
