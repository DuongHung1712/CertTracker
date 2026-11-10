import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { signInAsSeedAdmin } from "./support/restore-seed";
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
    await expect(row.getByText("Not a manager: team access not used")).toHaveCount(0);

    await setSeedManagerRole("member");
    await page.reload();
    await expect(row.getByText("Not a manager: team access not used")).toBeVisible();

    // The admin can clear the inert scopes from the row.
    await row.getByRole("button", { name: "Remove access" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove access" }).click();
    // While the confirm dialog is open the table is aria-hidden, so `row` matches nothing and a count of 0 would
    // pass even if the removal failed. Wait for the dialog to close, then check the row is back and really cleared.
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(row).toBeVisible();
    await expect(row.getByText("Not a manager: team access not used")).toHaveCount(0);
    await expect(row.getByText(/^Manages:/)).toHaveCount(0);
    await expect(row.getByText("—", { exact: true })).toBeVisible();
  } finally {
    await setSeedManagerRole("manager");
    await removeSeedManagerProgramScope();
    await cleanup();
  }
});

test("admin changes a member's access from the member form", async ({ page }) => {
  const cleanup = await giveSeedManagerAMember();
  try {
    await signIn(page, "admin@certtracker.test");
    await page.goto("/members");
    const row = page.getByRole("row", { name: new RegExp(MANAGER_NAME) });
    await expect(row.getByRole("cell", { name: "Manager", exact: true })).toBeVisible();

    await row.getByRole("button", { name: `Actions for ${MANAGER_NAME}` }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByRole("dialog").getByLabel("Access").click();
    await page.getByRole("option", { name: "Member", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row.getByRole("cell", { name: "Member", exact: true })).toBeVisible();
    await expect(row.getByText("Not a manager: team access not used")).toBeVisible();
  } finally {
    await setSeedManagerRole("manager");
    await cleanup();
  }
});

test("a member without an account shows No account and no access control", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByRole("dialog").getByLabel("Access")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Seed member An has no login: the table says so, and editing shows the note instead of a select.
  const row = page.getByRole("row", { name: /Nguyễn Văn An/ });
  await expect(row.getByRole("cell", { name: "No account" })).toBeVisible();
  await row.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByRole("dialog").getByText("No account yet. New accounts start as Member.")).toBeVisible();
});

// --- Member import (Task C3) ---
const IMPORT_PREFIX = "e2e-import-";

async function deleteImportedMembers() {
  const admin = await signInAsSeedAdmin();
  await admin.from("members").delete().like("email", `${IMPORT_PREFIX}%`);
}

function csvFile(lines: string[]) {
  return { name: "members.csv", mimeType: "text/csv", buffer: Buffer.from(["Full name,Email,Team,Career role", ...lines].join("\n")) };
}

test.describe("member import", () => {
  test.afterEach(deleteImportedMembers);

  test("admin imports members from a CSV", async ({ page }) => {
    const a = `${IMPORT_PREFIX}a-${Date.now()}@certtracker.test`;
    const b = `${IMPORT_PREFIX}b-${Date.now()}@certtracker.test`;
    await signIn(page, "admin@certtracker.test");
    await page.goto("/members");
    await page.getByRole("button", { name: "Import members" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "Download template" })).toHaveAttribute("href", "/templates/members-import.csv");
    await dialog.locator('input[type="file"]').setInputFiles(
      csvFile([`Import One,${a},Team Cloud,`, `Import Two,${b},Team AI,`, "Existing,an@certtracker.test,Team Cloud,", `Bad Team,${IMPORT_PREFIX}c@certtracker.test,Nowhere,`]),
    );
    await expect(dialog.getByText("2 to create, 1 skipped, 1 with errors")).toBeVisible();
    await expect(dialog.getByText('Team "Nowhere" does not exist')).toBeVisible();
    await expect(dialog.getByText("Already a member")).toBeVisible();
    await dialog.getByRole("button", { name: "Import 2 members" }).click();
    await expect(page.getByText("Imported 2 members.")).toBeVisible();
    await expect(page.getByRole("cell", { name: a })).toBeVisible();
    await expect(page.getByRole("cell", { name: b })).toBeVisible();
  });

  test("import button is disabled when nothing can be created", async ({ page }) => {
    await signIn(page, "admin@certtracker.test");
    await page.goto("/members");
    await page.getByRole("button", { name: "Import members" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles(csvFile(["Existing,an@certtracker.test,Team Cloud,"]));
    await expect(dialog.getByText("0 to create, 1 skipped, 0 with errors")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Import 0 members" })).toBeDisabled();
  });

  test("a manager and a member do not see Import members", async ({ page }) => {
    for (const email of ["manager@certtracker.test", "member@certtracker.test"]) {
      await signIn(page, email);
      await page.goto("/members");
      await expect(page.getByRole("button", { name: "Import members" })).toHaveCount(0);
      await page.context().clearCookies();
    }
  });

  test("importing twice skips the members already created", async ({ page }) => {
    const a = `${IMPORT_PREFIX}t-${Date.now()}@certtracker.test`;
    await signIn(page, "admin@certtracker.test");
    await page.goto("/members");
    await page.getByRole("button", { name: "Import members" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles(csvFile([`Twice,${a},Team Cloud,`]));
    await dialog.getByRole("button", { name: "Import 1 members" }).click();
    await expect(page.getByText("Imported 1 members.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Import members" }).click();
    dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles(csvFile([`Twice,${a},Team Cloud,`]));
    await expect(dialog.getByText("0 to create, 1 skipped, 0 with errors")).toBeVisible();
  });
});
