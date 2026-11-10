import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";
import { inviteLink } from "./support/accounts";
import { addSeedManagerProgramScope, MANAGER_USER_ID, removeSeedManagerProgramScope, SEED_PROGRAM_NAME } from "./support/manager-scopes";
import {
  acceptInvitation,
  addPilotMember,
  PILOT_PASSWORD,
  pilotEmail,
  removePilotPeople,
} from "./support/pilot-member";
import { signInAsSeedAdmin } from "./support/restore-seed";

const TEAM_CLOUD_ID = "5eed0000-0000-0000-0000-00000000a001";
const NEW_PASSWORD = "A-brand-new-password-2";

async function openProfileFromMenu(page: Page) {
  await page.getByRole("button", { name: /Account/ }).click();
  await page.getByRole("menuitem", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
}

async function setManagerScopes(scopes: { team_id?: string; program_id?: string }[]) {
  const admin = await signInAsSeedAdmin();
  const del = await admin.from("manager_scopes").delete().eq("user_id", MANAGER_USER_ID);
  if (del.error) throw new Error(del.error.message);
  for (const scope of scopes) {
    const ins = await admin.from("manager_scopes").insert({ user_id: MANAGER_USER_ID, ...scope });
    if (ins.error) throw new Error(ins.error.message);
  }
}

test("the user menu opens the profile page", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await openProfileFromMenu(page);
});

test("a member sees their account read-only", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await page.goto("/profile");
  const account = page.getByRole("region", { name: "Account" });
  await expect(account).toContainText("Lê Minh Châu");
  await expect(account).toContainText("member@certtracker.test");
  await expect(account).toContainText("Member");
  await expect(account).toContainText("Team Cloud");
  await expect(account.getByText(/^[A-Z]+-?\d+$/)).toBeVisible();
  await expect(account.getByText("Ask your admin to change your name or email.")).toBeVisible();
  await expect(account.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Your scope" })).toHaveCount(0);
});

test.describe("manager scope", () => {
  test.describe.configure({ mode: "serial" });
  test.afterAll(async () => {
    await removeSeedManagerProgramScope();
    await setManagerScopes([{ team_id: TEAM_CLOUD_ID }]);
  });

  test("a manager sees their scope", async ({ page }) => {
    await setManagerScopes([{ team_id: TEAM_CLOUD_ID }]);
    await signIn(page, "manager@certtracker.test");
    await page.goto("/profile");
    await expect(page.getByRole("region", { name: "Your scope" })).toContainText("Team Cloud");
  });

  test("a manager with only a program scope sees the program", async ({ page }) => {
    await setManagerScopes([]);
    await addSeedManagerProgramScope();
    await signIn(page, "manager@certtracker.test");
    await page.goto("/profile");
    const scope = page.getByRole("region", { name: "Your scope" });
    await expect(scope).toContainText(SEED_PROGRAM_NAME);
    await expect(scope).not.toContainText("Team Cloud");
  });

  test("a manager with no scope sees the empty line", async ({ page }) => {
    await setManagerScopes([]);
    await signIn(page, "manager@certtracker.test");
    await page.goto("/profile");
    await expect(page.getByRole("region", { name: "Your scope" })).toContainText("No teams or programs assigned yet.");
  });
});

test("an unlinked admin sees Not linked to a member", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/profile");
  await expect(page.getByRole("region", { name: "Account" })).toContainText("Not linked to a member");
  await expect(page.getByRole("region", { name: "My career" })).toHaveCount(0);
});

test("the career card lives on the profile page", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await page.goto("/profile");
  await expect(page.getByRole("region", { name: "My career" })).toBeVisible();
  await page.goto("/me");
  await expect(page.getByRole("heading", { level: 1, name: "My certificates" })).toBeVisible();
  await expect(page.getByTestId("career-yoe")).toHaveCount(0);
});

test.describe("change password", () => {
  const email = pilotEmail("pw");
  test.beforeAll(async () => {
    test.setTimeout(60_000);
    await removePilotPeople();
    await addPilotMember("Pilot Password Member", email, TEAM_CLOUD_ID);
  });
  test.afterAll(removePilotPeople);

  test("wrong current password, then the right one", async ({ page }) => {
    test.setTimeout(90_000);
    await acceptInvitation(page, email, (await inviteLink(email)).hash);
    await page.goto("/profile");

    await page.getByLabel("Current password").fill("not-the-password-1");
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("The current password is not correct.")).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    await page.goto("/profile");
    await page.getByLabel("Current password").fill(PILOT_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();

    await page.getByRole("button", { name: /Account/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
