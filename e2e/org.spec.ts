import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import {
  giveSeedManagerAMember,
  MANAGER_NAME,
  removeSeedManagerProgramScope,
  SEED_PROGRAM_NAME,
} from "./support/manager-scopes";

test("admin manages the org tree end to end", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/org");

  const dcName = `DC E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Add centre" }).click();
  await page.getByLabel("Centre name").fill(dcName);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: dcName })).toBeVisible();

  const programName = `Program E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Add program" }).click();
  await page.getByLabel("Program name").fill(programName);
  await page.getByLabel("Centre").click();
  await page.getByRole("option", { name: dcName }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: programName })).toBeVisible();

  // The DC now has a Program: deleting it must fail with the restricted message, not a raw Postgres error.
  // Scoped to the "Centres" section: the Program table also has a "Centre" column showing
  // this same DC name, so an unscoped `tr` filter on the page would match both tables' rows.
  const dcSection = page.locator("section", { has: page.getByRole("heading", { name: "Centres", exact: true }) });
  await dcSection
    .locator("tr", { has: page.getByRole("cell", { name: dcName, exact: true }) })
    .getByRole("button", { name: "Delete" })
    .click();
  await page.getByRole("button", { name: "Delete centre" }).click();
  await expect(page.getByText("This centre still has programs")).toBeVisible();
});

test("member has no write access to the org tree", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await expect(page.getByRole("link", { name: "Organisation" })).toHaveCount(0);

  // The nav link is hidden, but /org has no route guard — a Member who types the URL directly
  // must still land on a read-only page with no write controls (server-gated via canManage, not
  // just a client-side hide).
  await page.goto("/org");
  await expect(page.getByRole("heading", { name: "Organisation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add centre" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add program" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add team" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("admin assigns a manager to a program and the manager sees every team of that program", async ({ page, browser }) => {
  const cleanup = await giveSeedManagerAMember();
  try {
    await signIn(page, "admin@certtracker.test");
    await page.goto("/org");

    const programSection = page.locator("section", { has: page.getByRole("heading", { name: "Programs" }) });
    await programSection
      .locator("tr", { has: page.getByRole("cell", { name: SEED_PROGRAM_NAME, exact: true }) })
      .getByRole("button", { name: "Set managers" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: new RegExp(MANAGER_NAME) }).click();
    await dialog.getByRole("button", { name: "Save managers" }).click();
    await expect(page.getByText(`Saved managers for ${SEED_PROGRAM_NAME}`)).toBeVisible();

    // The seeded manager's own scope is Team Cloud only (An); the program scope adds Team AI (Bình).
    const managerContext = await browser.newContext();
    try {
      const managerPage = await managerContext.newPage();
      await signIn(managerPage, "manager@certtracker.test");
      await managerPage.goto("/members");
      await expect(managerPage.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toBeVisible();
      await expect(managerPage.getByRole("cell", { name: "Trần Thị Bình", exact: true })).toBeVisible();
    } finally {
      await managerContext.close();
    }
  } finally {
    await removeSeedManagerProgramScope();
    await cleanup();
  }
});
