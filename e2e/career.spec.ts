import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { CAREER_MEMBER_NAME, deleteSeedCareerRole, expectedYoe, setSeedMemberCareer } from "./support/career";

function yoeText(years: number): string {
  return `${years} ${years === 1 ? "year" : "years"}`;
}

// The tests share one seed member, so they run one after another and each starts from "no role, no start".
test.describe.configure({ mode: "serial" });
test.beforeEach(async () => {
  await setSeedMemberCareer(null, null);
});
test.afterAll(async () => {
  await setSeedMemberCareer(null, null);
});

test("member sets when they started working and sees the YoE; the role is read-only", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await page.goto("/me");

  await expect(page.getByTestId("career-role")).toHaveText("Not set");
  await expect(page.getByTestId("career-yoe")).toHaveText("Not set");
  // The role is set by the admin: no control for it on this page.
  await expect(page.getByRole("combobox", { name: "Career role" })).toHaveCount(0);

  await page.getByLabel("Month (optional)").click();
  await page.getByRole("option", { name: "March" }).click();
  await page.getByLabel("Year").fill("2020");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByTestId("career-yoe")).toHaveText(yoeText(expectedYoe(2020, 3)));
});

test("member cannot save a career start in the future", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await page.goto("/me");

  await page.getByLabel("Year").fill(String(new Date().getFullYear() + 1));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Career start can't be in the future")).toBeVisible();
  await expect(page.getByTestId("career-yoe")).toHaveText("Not set");
});

test("admin sets a member's role and career start in /members and sees the Role and YoE columns", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members");

  const row = page.getByRole("row", { name: new RegExp(CAREER_MEMBER_NAME) });
  await expect(row.getByRole("cell", { name: "Not set" })).toHaveCount(2);

  await row.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Career role").click();
  await page.getByRole("option", { name: "Senior Engineer" }).click();
  await dialog.getByLabel("Year").fill("2021");
  await dialog.getByRole("button", { name: "Save" }).click();
  // While the dialog is open the table is aria-hidden: wait for it to close before asserting on the row.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(page.getByRole("columnheader", { name: "Role" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "YoE" })).toBeVisible();
  await expect(row.getByRole("cell", { name: "Senior Engineer" })).toBeVisible();
  // Only a year was given: it counts from January.
  await expect(row.getByRole("cell", { name: yoeText(expectedYoe(2021, 1)) })).toBeVisible();
});

test("manager sees a member's role and career start read-only", async ({ page }) => {
  await setSeedMemberCareer("Senior Engineer", "2020-03-01");
  await signIn(page, "manager@certtracker.test");
  await page.goto("/members");

  const row = page.getByRole("row", { name: new RegExp(CAREER_MEMBER_NAME) });
  await expect(row.getByRole("cell", { name: "Senior Engineer" })).toBeVisible();
  await row.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();

  const dialog = page.getByRole("dialog");
  const readOnly = dialog.getByTestId("career-readonly");
  await expect(readOnly).toContainText("Senior Engineer");
  await expect(readOnly).toContainText(`March 2020 (${yoeText(expectedYoe(2020, 3))})`);
  await expect(dialog.getByLabel("Career role")).toHaveCount(0);
  await expect(dialog.getByLabel("Year")).toHaveCount(0);
});

test("admin manages the career roles; a role in use cannot be deleted", async ({ page }) => {
  const created = `QA Lead E2E ${Date.now()}`;
  const renamed = `${created} B`;
  try {
    await setSeedMemberCareer("Senior Engineer", "2020-03-01");
    await signIn(page, "admin@certtracker.test");
    await page.goto("/settings");

    const section = page.locator("section", { has: page.getByRole("heading", { name: "Career roles" }) });
    await expect(section.getByRole("cell", { name: "Senior Engineer", exact: true })).toBeVisible();

    // In use: the restrict error shows as a plain message.
    await section.getByRole("row", { name: /Senior Engineer/ }).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete role" }).click();
    await expect(page.getByText("This role is in use")).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(section.getByRole("cell", { name: "Senior Engineer", exact: true })).toBeVisible();

    // Add, move up, move down, rename, delete.
    await section.getByRole("button", { name: "Add career role" }).click();
    await page.getByRole("dialog").getByLabel("Role name").fill(created);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const names = () => section.locator("tbody tr td:nth-child(2)").allTextContents();
    await expect.poll(names).toEqual(["Engineer", "Senior Engineer", "Team Lead", "Project Manager", created]);

    await section.getByRole("button", { name: `Move ${created} up` }).click();
    await expect.poll(names).toEqual(["Engineer", "Senior Engineer", "Team Lead", created, "Project Manager"]);
    await section.getByRole("button", { name: `Move ${created} down` }).click();
    await expect.poll(names).toEqual(["Engineer", "Senior Engineer", "Team Lead", "Project Manager", created]);

    await section.getByRole("row", { name: new RegExp(created) }).getByRole("button", { name: "Rename" }).click();
    await page.getByRole("dialog").getByLabel("Role name").fill(renamed);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(section.getByRole("cell", { name: renamed, exact: true })).toBeVisible();

    await section.getByRole("row", { name: new RegExp(renamed) }).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete role" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(section.getByRole("cell", { name: renamed, exact: true })).toHaveCount(0);
  } finally {
    await deleteSeedCareerRole(created);
    await deleteSeedCareerRole(renamed);
  }
});
