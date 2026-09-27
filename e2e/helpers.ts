import { expect, type Page } from "@playwright/test";

// Local Supabase seed only (supabase/seed.sql) — never a real credential.
export const SEED_PASSWORD = "Password123!";

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}
