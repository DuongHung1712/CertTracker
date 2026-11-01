import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import {
  addSeedManagerProgramScope,
  giveSeedManagerAMember,
  MANAGER_NAME,
  removeSeedManagerProgramScope,
  SEED_PROGRAM_NAME,
  setSeedManagerRole,
} from "./support/manager-scopes";

test("admin creates and deletes a member", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members");

  const email = `e2e-${Date.now()}@certtracker.test`;
  await page.getByRole("button", { name: "Add member" }).click();
  // Scoped to the dialog: the table's FilterBar search box has aria-label "Search by name, code or email…",
  // whose substring match on "Email" collides with the dialog's own field under an unscoped getByLabel.
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Người Dùng E2E");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Team").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: email })).toBeVisible();

  await page.getByRole("row", { name: new RegExp(email) }).getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete member" }).click();
  // Wait for the confirm dialog to close first: while it is open the table is aria-hidden, so the cell
  // assertion would pass before the delete finishes and the test could end with the request still in flight.
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: email })).toHaveCount(0);
});

test("admin cannot delete a member who has training records", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members");

  // Seed member "Nguyễn Văn An" (5eed0000-0000-0000-0000-00000000b001) has a training_records
  // row (supabase/seed.sql) — the delete must be blocked by deleteMember's count guard, not
  // silently cascade-delete their certification history.
  await page
    .getByRole("row", { name: /Nguyễn Văn An/ })
    .getByRole("button", { name: /Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete member" }).click();
  await expect(page.getByText("This member still has certificates. Delete their certificates first.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toBeVisible();
});

test("manager cannot create or delete members, and only sees their managed team", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  await page.goto("/members");
  await expect(page.getByRole("button", { name: "Add member" })).toHaveCount(0);

  // manager@certtracker.test manages Team Cloud (5eed0000-0000-0000-0000-00000000a001, per
  // supabase/seed.sql's manager_scopes row). An is on Team Cloud; Bình is on Team AI, unmanaged.
  await expect(page.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Trần Thị Bình", exact: true })).toHaveCount(0);

  await page
    .getByRole("row", { name: /Nguyễn Văn An/ })
    .getByRole("button", { name: /Actions for/ })
    .click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
});

test("admin sees what a manager manages, and that the scopes go inactive when the role changes", async ({ page }) => {
  const cleanup = await giveSeedManagerAMember();
  try {
    await addSeedManagerProgramScope();
    await signIn(page, "admin@certtracker.test");
    await page.goto("/members");

    const row = page.getByRole("row", { name: new RegExp(MANAGER_NAME) });
    await expect(row.getByText(`Manages: Team Cloud, ${SEED_PROGRAM_NAME}`)).toBeVisible();
    await expect(row.getByText("Scopes inactive: not a manager")).toHaveCount(0);

    await setSeedManagerRole("member");
    await page.reload();
    await expect(row.getByText("Scopes inactive: not a manager")).toBeVisible();

    // The admin can clear the inert scopes from the row.
    await row.getByRole("button", { name: "Remove scopes" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove scopes" }).click();
    // While the confirm dialog is open the table is aria-hidden, so `row` matches nothing and a count of 0 would
    // pass even if the removal failed. Wait for the dialog to close, then check the row is back and really cleared.
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(row).toBeVisible();
    await expect(row.getByText("Scopes inactive: not a manager")).toHaveCount(0);
    await expect(row.getByText(/^Manages:/)).toHaveCount(0);
    await expect(row.getByText("—", { exact: true })).toBeVisible();
  } finally {
    await setSeedManagerRole("manager");
    await removeSeedManagerProgramScope();
    await cleanup();
  }
});
