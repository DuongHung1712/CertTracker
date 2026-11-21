import { expect, test, type Locator, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";
import { createCompletionFixture, sweepCompletionFixtures } from "./support/completion-fixture";
import { fillDatePassed, openOwnCertificateForm } from "./support/pilot-member";
import { restoreSeedLearning, signInAsSeedAdmin } from "./support/restore-seed";

// A timed-out test can skip its `finally`; this keeps the leftover fixture from reaching the next test or the database.
test.afterEach(sweepCompletionFixtures);

// Seed (supabase/seed.sql): one certificate, An–AWS. Decision #72: Bình's NVIDIA course and Châu's AWS plan are
// learning items, so the certificate list has no in-progress rows; tests about the journey use the Learning tab.
const AWS = "AWS Solutions Architect Associate";
const NVIDIA = "NVIDIA Generative AI LLMs";
const AN = "5eed0000-0000-0000-0000-00000000b001";
const NVIDIA_ID = "5eed0000-0000-0000-0000-00000000e002";
const CHAU = "5eed0000-0000-0000-0000-00000000b003";

/** An has no NVIDIA record in the seed; tests that create one must not leave it for the next test. */
async function removeAnNvidiaRecord() {
  const admin = await signInAsSeedAdmin();
  const { error } = await admin.from("training_records").delete().eq("member_id", AN).eq("certificate_id", NVIDIA_ID);
  if (error) throw new Error(`remove An–NVIDIA record: ${error.message}`);
}

/** Châu holds no certificate in the seed: removes any (and its proof file) a test added. */
async function removeChauCertificates() {
  const admin = await signInAsSeedAdmin();
  const records = await admin.from("training_records").select("evidence_path").eq("member_id", CHAU);
  if (records.error) throw new Error(`read Châu certificates: ${records.error.message}`);
  const files = records.data.flatMap((r) => (r.evidence_path ? [r.evidence_path] : []));
  if (files.length > 0) {
    const removed = await admin.storage.from("certificates").remove(files);
    if (removed.error) throw new Error(`remove proof: ${removed.error.message}`);
  }
  const deleted = await admin.from("training_records").delete().eq("member_id", CHAU);
  if (deleted.error) throw new Error(`remove Châu certificates: ${deleted.error.message}`);
}

// A failed run must not leak its rows into the tests after it (they assert one row per member).
test.beforeEach(async () => {
  await removeAnNvidiaRecord();
  await removeChauCertificates();
});

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

test("admin adds a record with evidence, opens it, and deletes it", async ({ page }) => {
  test.setTimeout(60_000); // upload + replace + cleanup, each waiting on server round trips and revalidation
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  // "tran" (no diacritics) must find "Trần Thị Bình".
  await pickOption(page, dialog, "Member", "tran", "Trần Thị Bình");
  await pickOption(page, dialog, "Certificate", "aws", AWS);
  // A certificate is always Completed (decision #72): no Progress field.
  await expect(dialog.getByLabel("Progress (%)")).toHaveCount(0);
  await dialog.getByLabel(fieldLabel("Date passed")).fill("01/06/2026");
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
    // The Evidence column shows the same file without opening the menu.
    await page.keyboard.press("Escape");
    await expect(row.getByRole("link", { name: "Proof file attached" })).toHaveAttribute("href", /^\/api\/records\/[0-9a-f-]+\/evidence$/);
    await openRowMenu(row);
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

test("the kind choice filters the certificate picker, clears the pick, and a reopened sheet starts empty", async ({ page }) => {
  const completion = await createCompletionFixture();
  try {
    await signIn(page, "admin@certtracker.test");
    await page.goto("/records");
    await page.getByRole("button", { name: "Add certificate" }).click();
    const dialog = page.getByRole("dialog");
    // Exam is the default: the completion is not offered.
    await expect(dialog.getByRole("tab", { name: "Exam certificate" })).toHaveAttribute("aria-selected", "true");
    await dialog.getByLabel(fieldLabel("Certificate")).fill(completion.certificateName);
    await expect(page.getByRole("option", { name: completion.optionName })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await dialog.getByLabel(fieldLabel("Certificate")).fill("aws");
    await page.getByRole("option", { name: AWS }).click();
    // Switching the kind clears the certificate; a course certificate has an issue date, not a date passed.
    await dialog.getByRole("tab", { name: "Course certificate" }).click();
    await expect(dialog.getByLabel(fieldLabel("Course certificate"))).toHaveValue("");
    await pickOption(page, dialog, "Course certificate", completion.certificateName, completion.optionName);
    await expect(dialog.getByLabel(fieldLabel("Issue date"))).toBeVisible();
    await expect(dialog.getByLabel(fieldLabel("Date passed"))).toHaveCount(0);

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Add certificate" }).click();
    await expect(page.getByRole("dialog").getByLabel(fieldLabel("Certificate"))).toHaveValue("");
    await expect(page.getByRole("dialog").getByRole("tab", { name: "Exam certificate" })).toHaveAttribute("aria-selected", "true");
  } finally {
    await completion.remove();
  }
});

test("a record for a course completion saves the granting course, and the table shows the kind", async ({ page }) => {
  const completion = await createCompletionFixture();
  try {
    await signIn(page, "admin@certtracker.test");
    await page.goto("/records");
    await page.getByRole("button", { name: "Add certificate" }).click();
    const dialog = page.getByRole("dialog");
    await pickOption(page, dialog, "Member", "nguyen", "Nguyễn Văn An");
    await dialog.getByRole("tab", { name: "Course certificate" }).click();
    await pickOption(page, dialog, "Course certificate", completion.certificateName, completion.optionName);
    await dialog.getByLabel(fieldLabel("Issue date")).fill("01/06/2026");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Added course completion")).toBeVisible();

    const admin = await signInAsSeedAdmin();
    const saved = await admin.from("training_records").select("course_id").eq("member_id", AN).eq("certificate_id", completion.certificateId).single();
    expect(saved.data?.course_id).toBe(completion.courseId);
    const row = recordRow(page, "Nguyễn Văn An", completion.certificateName);
    await expect(row).toContainText("Course completion");
  } finally {
    await completion.remove();
  }
});

test("the Kind filter separates exam certificates from course completions, and the dashboard counts them apart", async ({ page }) => {
  const completion = await createCompletionFixture();
  try {
    const admin = await signInAsSeedAdmin();
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    const added = await admin
      .from("training_records")
      .insert({ member_id: AN, certificate_id: completion.certificateId, status: "done", progress: 100, issued_date: today });
    if (added.error) throw new Error(`add completion record: ${added.error.message}`);

    await signIn(page, "admin@certtracker.test");
    await page.goto("/records");
    await expect(page.getByRole("heading", { name: "Learning", level: 1 })).toBeVisible();
    const completionRow = recordRow(page, "Nguyễn Văn An", completion.certificateName);
    const examRow = recordRow(page, "Nguyễn Văn An", AWS);

    await page.getByRole("combobox", { name: "Kind" }).click();
    await page.getByRole("option", { name: "Course certificates" }).click();
    await expect(completionRow).toBeVisible();
    await expect(examRow).toHaveCount(0);

    await page.getByRole("combobox", { name: "Kind" }).click();
    await page.getByRole("option", { name: "Exam certificates" }).click();
    await expect(examRow).toBeVisible();
    await expect(completionRow).toHaveCount(0);

    // Overview: the completion is counted in its own group and not in the exam figures (seed: 1 completed exam).
    await page.goto("/dashboard");
    const completions = page.getByRole("group", { name: "Course completions" });
    await expect(completions.locator("dl > div").filter({ hasText: "Completed this month" }).locator("dd")).toHaveText("1");
    const exams = page.getByRole("group", { name: "Exam certificates" });
    await expect(exams.locator("dl > div").filter({ hasText: /^Completed/ }).locator("dd")).toHaveText("1");
  } finally {
    await completion.remove();
  }
});

test("date rules are enforced in the form", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  // An has no NVIDIA record, so a stray successful save would be visible as a new row (and would fail the count below).
  await pickOption(page, dialog, "Member", "nguyen", "Nguyễn Văn An");
  await pickOption(page, dialog, "Certificate", "nvidia", "NVIDIA Generative AI LLMs");

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("A completed item needs a date")).toBeVisible();

  await dialog.getByLabel(fieldLabel("Date passed")).fill("31/02/2026");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Enter a valid date (dd/mm/yyyy)")).toBeVisible();

  await dialog.getByLabel(fieldLabel("Date passed")).fill("01/01/2099");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("The date cannot be in the future")).toBeVisible();

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
  await pickOption(page, dialog, "Certificate", "nvidia", "NVIDIA Generative AI LLMs");
  const row = recordRow(page, "Nguyễn Văn An", "NVIDIA Generative AI LLMs");
  try {
    // The schema shows the errors; the browser's own validation must not get in first.
    expect(await dialog.locator("form").evaluate((form: HTMLFormElement) => form.noValidate)).toBe(true);

    const issued = dialog.getByLabel(fieldLabel("Date passed"));
    await issued.fill("01/01/2099");
    await dialog.getByRole("button", { name: "Choose Date passed from calendar" }).click();
    const picker = dialog.locator('input[type="date"]');
    // Close the calendar the way the user would (on the hidden date input, so Escape cannot reach the sheet).
    await picker.evaluate((element: HTMLInputElement) => element.blur());
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("The date cannot be in the future")).toBeVisible();

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
  const note = `Admin note ${Date.now()}`;
  const added = await admin
    .from("training_records")
    .insert({ member_id: CHAU, certificate_id: NVIDIA_ID, status: "done", progress: 100, issued_date: "2026-06-01", notes: note })
    .select("id");
  if (added.error || added.data.length !== 1) throw new Error(`add Châu certificate: ${added.error?.message ?? "no row"}`);

  try {
    await signIn(page, "member@certtracker.test");
    await page.goto("/records");
    await expect(page).toHaveURL(/\/me$/);
    await clickMenuItem(page, recordRow(page, NVIDIA), "Edit");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(fieldLabel("Date passed")).fill("02/06/2026");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/^Saved certificate/).first()).toBeVisible();
    await expect(dialog).toHaveCount(0);

    const after = await admin.from("training_records").select("notes, issued_date").eq("member_id", CHAU).eq("certificate_id", NVIDIA_ID).single();
    expect(after.data).toEqual({ notes: note, issued_date: "2026-06-02" });
  } finally {
    await removeChauCertificates();
  }
});

test("manager sees only the managed team and can only pick managed members", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  await page.goto("/records");

  // The manager manages Team Cloud (An, Châu); Bình is on Team AI (supabase/seed.sql). An holds the only certificate;
  // Châu's and Bình's seed items are on the Learning tab.
  await expect(page.getByRole("button", { name: "Nguyễn Văn An", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trần Thị Bình", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: /^Learning/ }).click();
  await expect(recordRow(page, "Lê Minh Châu", AWS)).toBeVisible();
  await expect(recordRow(page, "Trần Thị Bình")).toHaveCount(0);
  await page.getByRole("tab", { name: /^Certificates/ }).click();

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(fieldLabel("Member")).click();
  await expect(page.getByRole("option", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Lê Minh Châu/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Trần Thị Bình/ })).toHaveCount(0);
  await expect(page.getByRole("option")).toHaveCount(2);
});

test("/records?search=<member> opens the admin's list already searched", async ({ page }) => {
  // The dashboard's Resolve / View links point here. A second certificate holder makes the narrowing visible.
  const admin = await signInAsSeedAdmin();
  const added = await admin.from("training_records").insert({ member_id: CHAU, certificate_id: NVIDIA_ID, status: "done", progress: 100, issued_date: "2026-06-01" });
  if (added.error) throw new Error(`add Châu certificate: ${added.error.message}`);
  try {
    await signIn(page, "admin@certtracker.test");
    await page.goto(`/records?search=${encodeURIComponent("Lê Minh Châu")}`);
    await expect(page.getByRole("button", { name: "Lê Minh Châu", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nguyễn Văn An", exact: true })).toHaveCount(0);
    await expect(page.getByPlaceholder(/Search by/)).toHaveValue("Lê Minh Châu");
  } finally {
    await removeChauCertificates();
  }
});

test("/records?search=<member> opens the manager's list already searched", async ({ page }) => {
  const admin = await signInAsSeedAdmin();
  const added = await admin.from("training_records").insert({ member_id: CHAU, certificate_id: NVIDIA_ID, status: "done", progress: 100, issued_date: "2026-06-01" });
  if (added.error) throw new Error(`add Châu certificate: ${added.error.message}`);
  try {
    await signIn(page, "manager@certtracker.test");
    await page.goto(`/records?search=${encodeURIComponent("Lê Minh Châu")}`);
    await expect(page.getByRole("button", { name: "Lê Minh Châu", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nguyễn Văn An", exact: true })).toHaveCount(0);
  } finally {
    await removeChauCertificates();
  }
});

test("member updates own progress on the Learning tab and cannot see company fields", async ({ page }) => {
  const admin = await signInAsSeedAdmin();
  try {
    await signIn(page, "member@certtracker.test");
    await page.goto("/me?tab=learning");
    // Châu's seed item is self-study for the AWS exam.
    const row = recordRow(page, AWS);
    await clickMenuItem(page, row, "Edit");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit learning" })).toBeVisible();
    await pickSelect(page, dialog, "Status", "In progress");
    await dialog.getByLabel("Progress (%)").fill("40");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    await expect(row).toContainText("40%");

    // The certificate form has no company fields and no Member picker for a member.
    await page.goto("/me");
    await page.getByRole("button", { name: "Add certificate" }).click();
    const form = page.getByRole("dialog");
    await expect(form.getByLabel(fieldLabel("Certificate"))).toBeVisible();
    await expect(form.getByLabel("Registered through the company")).toHaveCount(0);
    await expect(form.getByLabel("Refund status")).toHaveCount(0);
    await expect(form.getByLabel(fieldLabel("Member"))).toHaveCount(0);
  } finally {
    await restoreSeedLearning(admin);
  }
});

test("the certificate form offers to propose a missing certificate", async ({ page }) => {
  const hint = "Can't find yours?";
  await signIn(page, "member@certtracker.test");
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);

  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(hint, { exact: true })).toBeVisible();

  await dialog.getByLabel(fieldLabel("Certificate")).fill("zzzz-no-such-certificate");
  // The popup is portalled outside the dialog.
  await expect(page.getByText("No certificates found", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Propose a new certificate/ }).first()).toBeVisible();
});

test("member uploads, opens and removes evidence on their own certificate", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "member@certtracker.test");

  const row = recordRow(page, NVIDIA);
  const evidenceLink = page.getByRole("menuitem", { name: "View evidence" });
  try {
    const dialog = await openOwnCertificateForm(page, "nvidia", NVIDIA);
    await fillDatePassed(dialog);
    await dialog.getByLabel("Evidence", { exact: true }).setInputFiles("e2e/fixtures/evidence.pdf");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/^Added certificate/).first()).toBeVisible();
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
    await expect(row.getByRole("link", { name: "Proof file attached" })).toBeVisible();

    // Remove it through the sheet.
    await clickMenuItem(page, row, "Edit");
    const edit = page.getByRole("dialog");
    await expect(edit.getByRole("link", { name: "View current evidence" })).toBeVisible();
    await edit.getByRole("button", { name: "Remove evidence" }).click();
    await expect(page.getByText("Removed evidence")).toBeVisible();
    await edit.getByRole("button", { name: "Cancel" }).click();
    await expect(edit).toHaveCount(0);

    // Anchored on the always-present "Edit" item; retried until the revalidation has dropped the link.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await openRowMenu(row);
      await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible({ timeout: 1_500 });
      await expect(evidenceLink).toHaveCount(0, { timeout: 1_500 });
    }).toPass({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    // Still a certificate, now without proof: the Evidence column shows the gap.
    await expect(row.getByText("No proof yet")).toBeVisible();
  } finally {
    await removeChauCertificates();
  }
});

test("the Learning tab updates live for another user", async ({ page }) => {
  const admin = await signInAsSeedAdmin();
  await signIn(page, "manager@certtracker.test");
  await page.goto("/records?tab=learning");
  const row = recordRow(page, "Lê Minh Châu", AWS);
  await expect(row).toContainText("Not started");
  try {
    // Someone else (here the admin, straight in the database) updates Châu's item.
    const started = await admin.from("learning_items").update({ status: "in_progress", progress: 55 }).eq("member_id", CHAU).select("id");
    if (started.error || started.data.length !== 1) throw new Error(`start Châu's item: ${started.error?.message ?? "not found"}`);
    // No reload: Realtime must trigger the refresh.
    await expect(row).toContainText("55%", { timeout: 10_000 });
  } finally {
    await restoreSeedLearning(admin);
  }
  await expect(row).toContainText("Not started", { timeout: 10_000 });
});

test("a member's My learning page offers Certificates and Learning tabs, each with its own add action", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "My learning", level: 1 })).toBeVisible();
  await expect(page.getByText("Your certificates, and the courses and exams you are working on.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Certificates (0)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Passed an exam or finished a course? Add the certificate with its proof.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add certificate" })).toBeVisible();
  await page.getByRole("tab", { name: "Learning (1)" }).click();
  await expect(page).toHaveURL(/\/me\?tab=learning$/);
  await expect(page.getByRole("button", { name: "Add learning" })).toBeVisible();
  await expect(recordRow(page, AWS)).toContainText("Not started");
});

test("admin selects rows for a bulk delete, and a row click opens the edit sheet", async ({ page }) => {
  const admin = await signInAsSeedAdmin();
  const created = await admin
    .from("training_records")
    .insert([
      { member_id: AN, certificate_id: NVIDIA_ID, status: "done", progress: 100, issued_date: "2026-06-01" },
      { member_id: CHAU, certificate_id: NVIDIA_ID, status: "done", progress: 100, issued_date: "2026-06-01" },
    ])
    .select("id");
  if (created.error) throw new Error(`create QA rows: ${created.error.message}`);
  try {
    await signIn(page, "admin@certtracker.test");
    await page.goto("/records");

    // Clicking a row (not a control) opens the edit sheet.
    await recordRow(page, "Nguyễn Văn An", AWS).getByRole("cell").nth(4).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Edit certificate" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    const anNvidia = recordRow(page, "Nguyễn Văn An", "NVIDIA");
    const chauNvidia = recordRow(page, "Lê Minh Châu", "NVIDIA");
    await expect(anNvidia).toHaveCount(1);
    await expect(chauNvidia).toHaveCount(1);
    await anNvidia.getByRole("checkbox").click();
    await chauNvidia.getByRole("checkbox").click();
    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete 2 items" }).click();
    await expect(page.getByText("Deleted 2 items")).toBeVisible();
    await expect(anNvidia).toHaveCount(0);
    await expect(chauNvidia).toHaveCount(0);
  } finally {
    await admin.from("training_records").delete().in("id", (created.data ?? []).map((row) => row.id));
  }
});
