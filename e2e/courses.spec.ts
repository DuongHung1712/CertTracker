import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin adds a course and a member can only read it", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/courses");

  const courseName = `Course E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Thêm khóa học" }).click();
  // Scoped to the dialog: the table's FilterBar search box has aria-label "Tìm theo tên, loại, nhà cung cấp…",
  // whose substring match on "Nhà cung cấp" collides with the sheet's own field under an unscoped getByLabel.
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên khóa học").fill(courseName);
  await dialog.getByLabel("Loại chứng chỉ").click();
  await page.getByRole("option").first().click();
  await dialog.getByLabel("Nhà cung cấp").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "Lưu" }).click();
  // exact: the row's actions button is aria-labelled "Thao tác cho {course name}", so an
  // unscoped substring match on the course name also matches that cell.
  await expect(page.getByRole("cell", { name: courseName, exact: true })).toBeVisible();

  // "Đăng xuất" is a menu item behind the "Tài khoản" trigger (src/components/app-shell/user-menu.tsx), not a plain button — see e2e/auth.spec.ts for the same two-step pattern.
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await signIn(page, "member@certtracker.test");
  await page.goto("/courses");
  await expect(page.getByRole("cell", { name: courseName, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm khóa học" })).toHaveCount(0);
});
