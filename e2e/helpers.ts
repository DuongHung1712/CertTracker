import { expect, type Page } from "@playwright/test";

// Local Supabase seed only (supabase/seed.sql) — never a real credential.
export const SEED_PASSWORD = "Password123!";
export const ADMIN_EMAIL = "admin@certtracker.test";

/**
 * A certificate-form label with or without its required mark ("Course" or "Course *"). Playwright's `getByLabel`
 * counts the mark's text although it is `aria-hidden` (R12), so an exact string would stop matching.
 */
export function fieldLabel(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\*?$`);
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}
