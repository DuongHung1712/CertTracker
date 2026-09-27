import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin sees admin-only sections", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await expect(page.getByRole("link", { name: "Tổ chức" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import / Export" })).toBeVisible();
});

test("member sees only personal sections", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await expect(page.getByRole("link", { name: "Chứng chỉ của tôi" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tổ chức" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Thành viên" })).toHaveCount(0);
});

test("sidebar link navigates, marks the breadcrumb and the active item", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  // Scoped to the sidebar nav: the active breadcrumb item also has role
  // "link" (it's a disabled <span role="link">), so an unscoped query for
  // "Khóa học" matches both.
  const link = page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Khóa học" });
  await link.click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole("heading", { name: "Khóa học" })).toBeVisible();
  await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText("Khóa học");
  await expect(link).toHaveAttribute("aria-current", "page");
});
