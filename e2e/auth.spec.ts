import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, SEED_PASSWORD, fieldLabel, signIn } from "./helpers";

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
  await page.getByLabel(fieldLabel("Password")).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText("Wrong email or password. Check them and try again.");
});

async function signInFromLogin(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(fieldLabel("Password")).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a signed-out visit to a filtered page returns there after sign-in (admin)", async ({ page }) => {
  await page.goto("/records?search=Tran");
  await expect(page).toHaveURL(/\/login\?next=%2Frecords%3Fsearch%3DTran$/);
  await expect(page.getByLabel("Email")).toBeFocused();
  await signInFromLogin(page, ADMIN_EMAIL);
  await expect(page).toHaveURL(/\/records\?search=Tran$/);
});

test("a member sent to /records is bounced on to /me after sign-in", async ({ page }) => {
  await page.goto("/records?search=Tran");
  await signInFromLogin(page, "member@certtracker.test");
  await expect(page).toHaveURL(/\/me$/);
});

test("an unsafe next value is ignored and sign-in lands on the dashboard", async ({ page }) => {
  await page.goto("/login?next=" + encodeURIComponent("/.//evil.com"));
  await signInFromLogin(page, ADMIN_EMAIL);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a signed-in user opening /login with a dot-segment next value never leaves the app", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  const response = await page.request.get("/login?next=" + encodeURIComponent("/.//evil.com"), { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers()["location"], "http://localhost:3000").host).toBe("localhost:3000");
});

test("the password toggle shows and hides what was typed", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByLabel(fieldLabel("Password"));
  await password.fill("abc");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});
