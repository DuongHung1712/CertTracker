import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, signIn } from "./helpers";

test("unauthenticated visitor is sent to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("admin signs in, sees dashboard, and signs out", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  // Scoped to the shell's account button: the dashboard profile card also shows an "Admin" badge.
  const account = page.getByRole("button", { name: /^Account:/ });
  await expect(account.getByText("Admin", { exact: true })).toBeVisible();

  await account.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText("Wrong email or password. Check them and try again.");
});
