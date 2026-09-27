import { expect, test, type Page } from "@playwright/test";

// Credentials come from supabase/seed.sql (local test users only).
const SEED_PASSWORD = "Password123!";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

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

test("sidebar link navigates and marks the breadcrumb", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.getByRole("link", { name: "Khóa học" }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole("heading", { name: "Khóa học" })).toBeVisible();
});
