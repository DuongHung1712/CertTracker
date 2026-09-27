import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const ADMIN_EMAIL = "admin@certtracker.test";

test("unauthenticated visitor is sent to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("admin signs in, sees dashboard, and signs out", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await expect(page.getByText("Quản trị")).toBeVisible();

  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Mật khẩu").fill("wrong-password");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText("Email hoặc mật khẩu không đúng");
});
