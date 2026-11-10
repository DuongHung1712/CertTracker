import { expect, test, type Locator, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";
import { signInAsSeedAdmin } from "./support/restore-seed";

// Seed rows (supabase/seed.sql): An–AWS done, Bình–NVIDIA in_progress 40, Châu–AWS not_started 0.
const AWS = "AWS Solutions Architect Associate";
const AN = "5eed0000-0000-0000-0000-00000000b001";
const NVIDIA_ID = "5eed0000-0000-0000-0000-00000000e002";

/** An has no NVIDIA record in the seed; tests that create one must not leave it for the next test. */
async function removeAnNvidiaRecord() {
  const admin = await signInAsSeedAdmin();
  const { error } = await admin.from("training_records").delete().eq("member_id", AN).eq("course_id", NVIDIA_ID);
  if (error) throw new Error(`remove An–NVIDIA record: ${error.message}`);
}

const CHAU = "5eed0000-0000-0000-0000-00000000b003";
const AWS_ID = "5eed0000-0000-0000-0000-00000000e001";

/** Châu–AWS back to the seed state (Not started, 0%, no issue date, no proof file), without going through the UI. */
async function restoreChauAwsSeed() {
  const admin = await signInAsSeedAdmin();
  const record = await admin.from("training_records").select("evidence_path").eq("member_id", CHAU).eq("course_id", AWS_ID).single();
  if (record.error) throw new Error(`read Châu–AWS: ${record.error.message}`);
  if (record.data.evidence_path) {
    const removed = await admin.storage.from("certificates").remove([record.data.evidence_path]);
    if (removed.error) throw new Error(`remove proof: ${removed.error.message}`);
  }
  const reset = await admin
    .from("training_records")
    .update({ status: "not_started", progress: 0, issued_date: null, evidence_path: null })
    .eq("member_id", CHAU)
    .eq("course_id", AWS_ID);
  if (reset.error) throw new Error(`reset Châu–AWS: ${reset.error.message}`);
}

// A failed run must not leak its An–NVIDIA record into the tests after it (they assert one row per member).
test.beforeEach(removeAnNvidiaRecord);

/** Row that contains every given text (the row's accessible name is unreliable across columns). */
function recordRow(page: Page, ...texts: string[]): Locator {
  let row = page.getByRole("row");
  for (const text of texts) row = row.filter({ hasText: text });
  return row;
}

/** Opens a searchable combobox in the sheet, types a query and picks the option with `optionName`. */
async function pickOption(page: Page, dialog: Locator, label: string, query: string, optionName: string) {
  await dialog.getByLabel(fieldLabel(label)).fill(query);
  // The popup is portalled outside the dialog.
  await page.getByRole("option", { name: optionName }).click();
}

/** Picks a value in a Base UI `Select`; its listbox is portalled outside the dialog. */
async function pickSelect(page: Page, dialog: Locator, label: string, optionName: string) {
  await dialog.getByLabel(fieldLabel(label)).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

async function openRowMenu(row: Locator) {
  await row.getByRole("button", { name: /Actions for/ }).click();
}

/**
 * Opens the row menu and clicks an item, reopening if it vanishes. A Realtime refresh (the debounced
 * `router.refresh()` after an upload) can re-render the list and drop an open menu under the click.
 * Only for use while no dialog/sheet is open, since it presses Escape first.
 */
async function clickMenuItem(page: Page, row: Locator, name: string) {
  await expect(async () => {
    await page.keyboard.press("Escape");
    await openRowMenu(row);
    await page.getByRole("menuitem", { name }).click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

/** Admin/manager edit of a record's status + progress through the row menu; waits for the save toast. */
async function editStatus(page: Page, row: Locator, status: string, progress: string) {
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await pickSelect(page, dialog, "Status", status);
  // Progress is only shown for In progress; Not started resets it to 0 on its own.
  if (status === "In progress") await dialog.getByLabel("Progress (%)").fill(progress);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved certificate").first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

test("admin adds a record with evidence, opens it, and deletes it", async ({ page }) => {
  test.setTimeout(60_000); // upload + replace + cleanup, each waiting on server round trips and revalidation
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  // "tran" (no diacritics) must find "Trần Thị Bình".
  await pickOption(page, dialog, "Member", "tran", "Trần Thị Bình");
  await pickOption(page, dialog, "Course", "aws", AWS);
  await pickSelect(page, dialog, "Status", "Completed");
  // Completed hides Progress (it is saved as 100).
  await expect(dialog.getByLabel("Progress (%)")).toHaveCount(0);
  await dialog.getByLabel(fieldLabel("Issue date")).fill("01/06/2026");
  await dialog.getByLabel("Evidence").setInputFiles("e2e/fixtures/evidence.pdf");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Added certificate")).toBeVisible();

  const row = recordRow(page, "Trần Thị Bình", AWS);
  await expect(row).toContainText("Valid");

  try {
    // The evidence upload revalidates the list after the record itself appears, so retry until the link exists.
    const link = page.getByRole("menuitem", { name: "View evidence" });
    await expect(async () => {
      await page.keyboard.press("Escape");
      await openRowMenu(row);
      await expect(link).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/api\/records\/[0-9a-f-]+\/evidence$/);
    const response = await page.request.get(href!, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const oldUrl = response.headers()["location"];
    expect(oldUrl).toContain("/storage/v1/object/sign/certificates/");
    expect(oldUrl).toContain(".pdf");
    // The signed URL works before the replacement (this is what makes the "gone" check below meaningful).
    expect((await page.request.get(oldUrl)).status()).toBe(200);
    await page.keyboard.press("Escape");

    // Replace the evidence: upload a PNG over the PDF through "Edit".
    await clickMenuItem(page, row, "Edit");
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel("Evidence", { exact: true }).setInputFiles("e2e/fixtures/evidence.png");
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved certificate").first()).toBeVisible();
    await expect(editDialog).toHaveCount(0);

    // The upload revalidates after the save, so poll until the route resolves to the new object.
    let newUrl = "";
    await expect(async () => {
      const replaced = await page.request.get(href!, { maxRedirects: 0 });
      expect(replaced.status()).toBe(307);
      newUrl = replaced.headers()["location"];
      expect(newUrl).toContain(".png");
    }).toPass({ timeout: 15_000 });
    expect(newUrl).not.toBe(oldUrl);
    expect((await page.request.get(newUrl)).status()).toBe(200);
    // The previous object was deleted from Storage, so its (still unexpired) signed URL no longer serves it.
    expect((await page.request.get(oldUrl)).status()).toBeGreaterThanOrEqual(400);
  } finally {
    // Always remove the record, even when an assertion above failed, so the run stays re-runnable.
    await clickMenuItem(page, row, "Delete");
    await page.getByRole("button", { name: "Delete certificate" }).click();
    // Wait for the toast first: while the confirm dialog is open the page behind it is aria-hidden,
    // so `getByRole("row")` would report zero rows immediately, before the delete has happened.
    await expect(page.getByText("Deleted certificate")).toBeVisible();
    await expect(row).toHaveCount(0);
  }
});

test("a second record for the same member and course is refused", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await pickOption(page, dialog, "Member", "nguyen", "Nguyễn Văn An");
  await pickOption(page, dialog, "Course", "aws", AWS);
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(
    dialog.getByText("This member already has a certificate for this course. Edit the existing certificate instead of creating a new one."),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("status rules are enforced in the form", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  // An has no NVIDIA record, so a stray successful save would be visible as a new row (and would fail the count below).
  await pickOption(page, dialog, "Member", "nguyen", "Nguyễn Văn An");
  await pickOption(page, dialog, "Course", "nvidia", "NVIDIA Generative AI LLMs");
  await pickSelect(page, dialog, "Status", "Completed");

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("A completed course needs an issue date")).toBeVisible();

  await dialog.getByLabel(fieldLabel("Issue date")).fill("31/02/2026");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Enter a valid issue date (dd/mm/yyyy)")).toBeVisible();

  await dialog.getByLabel(fieldLabel("Issue date")).fill("01/01/2099");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("The issue date cannot be in the future")).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(recordRow(page, "Nguyễn Văn An", "NVIDIA Generative AI LLMs")).toHaveCount(0);
});

test("R13: a future date left in the calendar never blocks Save silently", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await pickOption(page, dialog, "Member", "nguyen", "Nguyễn Văn An");
  await pickOption(page, dialog, "Course", "nvidia", "NVIDIA Generative AI LLMs");
  await pickSelect(page, dialog, "Status", "Completed");
  const row = recordRow(page, "Nguyễn Văn An", "NVIDIA Generative AI LLMs");
  try {
    // The schema shows the errors; the browser's own validation must not get in first.
    expect(await dialog.locator("form").evaluate((form: HTMLFormElement) => form.noValidate)).toBe(true);

    const issued = dialog.getByLabel(fieldLabel("Issue date"));
    await issued.fill("01/01/2099");
    await dialog.getByRole("button", { name: "Choose Issue date from calendar" }).click();
    const picker = dialog.locator('input[type="date"]');
    // Close the calendar the way the user would (on the hidden date input, so Escape cannot reach the sheet).
    await picker.evaluate((element: HTMLInputElement) => element.blur());
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("The issue date cannot be in the future")).toBeVisible();

    // Correcting the text must not leave the old date behind in the hidden calendar input.
    await issued.fill("01/06/2026");
    expect(await picker.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(true);
    expect(await dialog.locator("form").evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(true);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Added certificate")).toBeVisible();
    await expect(row).toBeVisible();
  } finally {
    await removeAnNvidiaRecord();
  }
});

test("R10: a member's save keeps the notes an admin wrote", async ({ page }) => {
  const admin = await signInAsSeedAdmin();
  const seed = await admin.from("training_records").select("notes").eq("member_id", CHAU).eq("course_id", AWS_ID).single();
  if (seed.error) throw new Error(`read seed note: ${seed.error.message}`);
  const note = `Admin note ${Date.now()}`;
  const set = await admin.from("training_records").update({ notes: note }).eq("member_id", CHAU).eq("course_id", AWS_ID).select("id");
  if (set.error || set.data.length !== 1) throw new Error(`set note: ${set.error?.message ?? "no row"}`);

  try {
    await signIn(page, "member@certtracker.test");
    await page.goto("/records");
    await expect(page).toHaveURL(/\/me$/);
    const row = recordRow(page, AWS);
    await openRowMenu(row);
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await pickSelect(page, dialog, "Status", "In progress");
    await dialog.getByLabel("Progress (%)").fill("30");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved certificate").first()).toBeVisible();
    await expect(row).toContainText("30%");

    const after = await admin.from("training_records").select("notes, progress").eq("member_id", CHAU).eq("course_id", AWS_ID).single();
    expect(after.data).toEqual({ notes: note, progress: 30 });
  } finally {
    // Seed state: Not started / 0, the seed note.
    const restore = await admin
      .from("training_records")
      .update({ status: "not_started", progress: 0, notes: seed.data.notes })
      .eq("member_id", CHAU)
      .eq("course_id", AWS_ID)
      .select("id");
    if (restore.error || restore.data.length !== 1) throw new Error(`restore seed record: ${restore.error?.message ?? "no row"}`);
  }
});

test("manager sees only the managed team and can only pick managed members", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  await page.goto("/records");

  // The manager manages Team Cloud (An, Châu); Bình is on Team AI (supabase/seed.sql).
  await expect(page.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Lê Minh Châu", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Trần Thị Bình", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(fieldLabel("Member")).click();
  await expect(page.getByRole("option", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Lê Minh Châu/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Trần Thị Bình/ })).toHaveCount(0);
  await expect(page.getByRole("option")).toHaveCount(2);
});

test("/records?search=<member> opens the admin's list already searched", async ({ page }) => {
  // The dashboard's Resolve / View links point here.
  await signIn(page, "admin@certtracker.test");
  await page.goto(`/records?search=${encodeURIComponent("Trần Thị Bình")}`);
  await expect(page.getByRole("cell", { name: "Trần Thị Bình", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Lê Minh Châu", exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder(/Search by/)).toHaveValue("Trần Thị Bình");
});

test("/records?search=<member> opens the manager's list already searched", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  await page.goto(`/records?search=${encodeURIComponent("Lê Minh Châu")}`);
  await expect(page.getByRole("cell", { name: "Lê Minh Châu", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Nguyễn Văn An", exact: true })).toHaveCount(0);
});

test("member updates own progress and cannot see company fields", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);

  const row = recordRow(page, AWS);
  try {
    await openRowMenu(row);
    // Anchor on a visible item first: a count of 0 before the menu has rendered would pass vacuously.
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(fieldLabel("Course"))).toBeVisible();
    await expect(dialog.getByLabel("Registered through the company")).toHaveCount(0);
    await expect(dialog.getByLabel("Refund status")).toHaveCount(0);
    await expect(dialog.getByLabel(fieldLabel("Member"))).toHaveCount(0);

    await pickSelect(page, dialog, "Status", "In progress");
    await dialog.getByLabel("Progress (%)").fill("40");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved certificate").first()).toBeVisible();
    await expect(row).toContainText("40%");
  } finally {
    // Restore the seed state (Not started / 0) so the suite can run again on the same database.
    await page.keyboard.press("Escape");
    await editStatus(page, row, "Not started", "0");
    await expect(row).toContainText("0%");
  }
});

test("the certificate form says what to do when a course is missing", async ({ page }) => {
  const hint = "Can't find your course? Ask your admin to add it.";
  await signIn(page, "member@certtracker.test");
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(hint, { exact: true })).toBeVisible();

  await dialog.getByLabel(fieldLabel("Course")).fill("zzzz-no-such-course");
  // The popup is portalled outside the dialog.
  await expect(page.getByText("No courses found", { exact: true })).toBeVisible();
  await expect(dialog.getByText(hint, { exact: true })).toBeVisible();
});

test("member uploads, opens and removes evidence on their own record", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "member@certtracker.test");
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);

  const row = recordRow(page, AWS);
  const evidenceLink = page.getByRole("menuitem", { name: "View evidence" });
  try {
    // Upload through the sheet (the seed record has no evidence).
    await openRowMenu(row);
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect(evidenceLink).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Edit" }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(fieldLabel("Course"))).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Remove evidence" })).toHaveCount(0);
    // R11: evidence is only offered for a Completed certificate.
    await expect(dialog.getByLabel("Evidence", { exact: true })).toHaveCount(0);
    await pickSelect(page, dialog, "Status", "Completed");
    await dialog.getByLabel(fieldLabel("Issue date")).fill("01/06/2026");
    await dialog.getByLabel("Evidence", { exact: true }).setInputFiles("e2e/fixtures/evidence.pdf");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved certificate").first()).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // The upload revalidates after the record save, so retry until the menu shows the link.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await openRowMenu(row);
      await expect(evidenceLink).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    const href = await evidenceLink.getAttribute("href");
    expect(href).toMatch(/^\/api\/records\/[0-9a-f-]+\/evidence$/);
    const response = await page.request.get(href!, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/storage/v1/object/sign/certificates/");
    await page.keyboard.press("Escape");

    // Remove it through the sheet.
    await clickMenuItem(page, row, "Edit");
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "View current evidence" })).toBeVisible();
    // R11: leaving Completed hides the whole evidence block (the stored file is left alone; nothing is saved here).
    await pickSelect(page, dialog, "Status", "In progress");
    await expect(dialog.getByRole("link", { name: "View current evidence" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Remove evidence" })).toHaveCount(0);
    await expect(dialog.getByLabel("Evidence", { exact: true })).toHaveCount(0);
    await pickSelect(page, dialog, "Status", "Completed");
    await expect(dialog.getByRole("link", { name: "View current evidence" })).toBeVisible();
    await dialog.getByRole("button", { name: "Remove evidence" }).click();
    await expect(page.getByText("Removed evidence")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    // Anchored on the always-present "Edit" item; retried until the revalidation has dropped the link.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await openRowMenu(row);
      await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible({ timeout: 1_500 });
      await expect(evidenceLink).toHaveCount(0, { timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    await page.keyboard.press("Escape");
  } finally {
    await restoreChauAwsSeed();
  }
});

test("the list updates live for another user", async ({ browser }) => {
  const managerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  try {
    const managerPage = await managerContext.newPage();
    const adminPage = await adminContext.newPage();
    await signIn(managerPage, "manager@certtracker.test");
    await signIn(adminPage, "admin@certtracker.test");
    await managerPage.goto("/records");
    await adminPage.goto("/records");

    // After Week 4's import spec Châu can have a second record, so pin the row by member and course.
    const managerRow = recordRow(managerPage, "Lê Minh Châu", AWS);
    const adminRow = recordRow(adminPage, "Lê Minh Châu", AWS);
    await expect(managerRow).toContainText("0%");
    await expect(adminRow).toBeVisible();

    try {
      await editStatus(adminPage, adminRow, "In progress", "55");
      // No reload on the manager page: Realtime must trigger the refresh.
      await expect(managerRow).toContainText("55%", { timeout: 10_000 });
    } finally {
      await adminPage.keyboard.press("Escape");
      await editStatus(adminPage, adminRow, "Not started", "0");
    }
    await expect(managerRow).toContainText("0%", { timeout: 10_000 });
  } finally {
    await managerContext.close();
    await adminContext.close();
  }
});
