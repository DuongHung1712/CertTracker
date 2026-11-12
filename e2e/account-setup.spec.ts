import { expect, test, type Page } from "@playwright/test";
import { deleteAccount, inviteLink } from "./support/accounts";
import { signInAsSeedAdmin } from "./support/restore-seed";

const SEED_TEAM_CLOUD_ID = "5eed0000-0000-0000-0000-00000000a001";
const PASSWORD = "A-new-password-1";

async function setPassword(page: Page, hash: string, type: string, password = PASSWORD) {
  await page.goto(`/set-password?token_hash=${hash}&type=${type}`);
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Save password" }).click();
}

test.describe.configure({ mode: "serial" });

const email = `invited-${Date.now()}@certtracker.test`;
let userId = "";
let inviteHash = "";

test.beforeAll(async () => {
  const seedAdmin = await signInAsSeedAdmin();
  const { error: memberError } = await seedAdmin
    .from("members")
    .insert({ full_name: "Invited E2E", email, team_id: SEED_TEAM_CLOUD_ID });
  if (memberError) throw new Error(memberError.message);
  ({ userId, hash: inviteHash } = await inviteLink(email));
});

test.afterAll(async () => {
  if (userId) await deleteAccount(userId);
  const seedAdmin = await signInAsSeedAdmin();
  await seedAdmin.from("members").delete().eq("email", email);
});

test("opening the link alone does not use it up, and a mismatch keeps it valid", async ({ page }) => {
  await page.goto(`/set-password?token_hash=${inviteHash}&type=invite`);
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill("Something-else-1");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("The two passwords do not match");
});

test("an invited member sets a password, signs in as Member and sees their own page", async ({ page }) => {
  await setPassword(page, inviteHash, "invite");
  await expect(page).toHaveURL(/\/login\?passwordSet=1$/);
  await expect(page.getByText("Password saved. Sign in with your new password.")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "My learning" })).toBeVisible();
  await expect(page.getByText("Your account is not linked to a member")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
});

test("a link that was already used is refused with a way forward", async ({ page }) => {
  await setPassword(page, inviteHash, "invite");
  await expect(page.locator("form").getByRole("alert")).toHaveText("This link has expired or was already used. Ask your admin for a new one.");
});

test("a broken link shows no form", async ({ page }) => {
  await page.goto("/set-password?type=magiclink");
  await expect(page.getByText("This link is not valid. Ask your admin for a new one.")).toBeVisible();
  await expect(page.getByLabel("New password")).toHaveCount(0);
});

test("a recovery link works while another user is signed in", async ({ page }) => {
  const { hash } = await inviteLink(email, "recovery");
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@certtracker.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await setPassword(page, hash, "recovery", "Another-password-2");
  await expect(page).toHaveURL(/\/login\?passwordSet=1$/);
});
