import { expect, test, type Locator, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";
import { createCompletionFixture, sweepCompletionFixtures } from "./support/completion-fixture";
import { signInAsSeedAdmin } from "./support/restore-seed";

// A timed-out test can skip its `finally`; this keeps the leftover fixture from reaching the next test or the database.
test.afterEach(sweepCompletionFixtures);

// The form is opened and cancelled only: nothing is saved, so the seed stays untouched. Two exceptions put everything
// back: R16 edits one seed note, and the Course studied test creates a completion (and its course) and removes it.

/** Picks a value in a Base UI `Select`; its listbox is portalled outside the dialog. */
async function pickSelect(page: Page, dialog: Locator, label: string, optionName: string) {
  await dialog.getByLabel(fieldLabel(label)).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

async function openAddForm(page: Page): Promise<Locator> {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");
  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(fieldLabel("Status"))).toBeVisible();
  return dialog;
}

async function expectFields(dialog: Locator, shown: string[], hidden: string[]) {
  for (const label of shown) await expect(dialog.getByLabel(fieldLabel(label))).toBeVisible();
  for (const label of hidden) await expect(dialog.getByLabel(fieldLabel(label))).toHaveCount(0);
}

test("the form shows the fields that belong to the chosen status", async ({ page }) => {
  const dialog = await openAddForm(page);

  // A new certificate starts as Not started.
  await expectFields(dialog, ["Planned exam date"], ["Progress (%)", "Date passed", "Certificate link"]);

  await pickSelect(page, dialog, "Status", "In progress");
  await expectFields(dialog, ["Progress (%)", "Planned exam date"], ["Date passed", "Certificate link"]);

  await pickSelect(page, dialog, "Status", "Completed");
  await expectFields(dialog, ["Date passed", "Certificate link"], ["Progress (%)", "Planned exam date"]);

  await pickSelect(page, dialog, "Status", "Not started");
  await expectFields(dialog, ["Planned exam date"], ["Progress (%)", "Date passed", "Certificate link"]);
});

test("switching status resets progress and clears the dates that no longer apply", async ({ page }) => {
  const dialog = await openAddForm(page);

  await pickSelect(page, dialog, "Status", "Completed");
  await dialog.getByLabel(fieldLabel("Date passed")).fill("01/06/2026");
  await dialog.getByLabel("Certificate link").fill("https://example.com/cert");

  // Completed (100) -> In progress starts again from 0.
  await pickSelect(page, dialog, "Status", "In progress");
  await expect(dialog.getByLabel("Progress (%)")).toHaveValue("0");
  await dialog.getByLabel(fieldLabel("Planned exam date")).fill("15/12/2026");

  // Back to Completed: the issue date and link were cleared when they were hidden.
  await pickSelect(page, dialog, "Status", "Completed");
  await expect(dialog.getByLabel(fieldLabel("Date passed"))).toHaveValue("");
  await expect(dialog.getByLabel("Certificate link")).toHaveValue("");

  // And the planned exam date was cleared on the way to Completed.
  await pickSelect(page, dialog, "Status", "In progress");
  await expect(dialog.getByLabel(fieldLabel("Planned exam date"))).toHaveValue("");
});

test("typing digits in a date field inserts the slashes", async ({ page }) => {
  const dialog = await openAddForm(page);
  await pickSelect(page, dialog, "Status", "Completed");

  const issued = dialog.getByLabel(fieldLabel("Date passed"));
  await issued.pressSequentially("01082026");
  await expect(issued).toHaveValue("01/08/2026");

  // Backspace removes the year, then the slash it leaves behind, then the month digits one by one.
  for (let press = 0; press < 5; press++) await issued.press("Backspace");
  await expect(issued).toHaveValue("01/08");
  await issued.press("Backspace");
  await expect(issued).toHaveValue("01/0");
});

test("the calendar button fills the date field as dd/mm/yyyy", async ({ page }) => {
  const dialog = await openAddForm(page);
  await pickSelect(page, dialog, "Status", "Completed");

  await expect(dialog.getByRole("button", { name: "Choose Date passed from calendar" })).toBeVisible();
  // Playwright cannot drive the browser's native date popup, so set the hidden date input the way the popup would.
  const picker = dialog.locator('input[type="date"]');
  await expect(picker).toHaveCount(1);
  await picker.evaluate((element: HTMLInputElement) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setValue.call(element, "2026-08-01");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(dialog.getByLabel(fieldLabel("Date passed"))).toHaveValue("01/08/2026");
});

test("Course studied is always shown: disabled until a certificate is chosen, optional for an exam, read-only for a completion", async ({ page }) => {
  const dialog = await openAddForm(page);
  // An admin gets a way to fix it; the member's hint is covered in records.spec.ts.
  await expect(dialog.getByRole("link", { name: "Add it in the Catalogue" })).toHaveAttribute("href", "/courses");
  await expect(dialog.getByLabel(fieldLabel("Course studied"))).toBeDisabled();
  await expect(dialog.getByText("Choose the exam first.")).toBeVisible();

  await dialog.getByLabel(fieldLabel("Certificate")).fill("aws");
  await page.getByRole("option", { name: "AWS Solutions Architect Associate" }).click();
  await dialog.getByLabel(fieldLabel("Course studied")).click();
  await expect(page.getByRole("option", { name: "None (self-study)", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "AWS Solutions Architect Associate", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Optional. Pick the course you used, if any.")).toBeVisible();

  const completion = await createCompletionFixture();
  try {
    await page.reload();
    await page.getByRole("button", { name: "Add certificate" }).click();
    await dialog.getByRole("tab", { name: "Course completion" }).click();
    await dialog.getByLabel(fieldLabel("Course completion")).fill(completion.certificateName);
    await page.getByRole("option", { name: completion.optionName }).click();
    // Plain text, not an input that looks editable.
    const studied = dialog.getByLabel(fieldLabel("Course studied"));
    await expect(studied).toHaveText(completion.courseName);
    await expect(dialog.locator("input#record-course-studied")).toHaveCount(0);
  } finally {
    await completion.remove();
  }
});

// ROUND 2: R10, R11, R12, R16, R18.

async function openOwnForm(page: Page): Promise<Locator> {
  await signIn(page, "member@certtracker.test");
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(fieldLabel("Status"))).toBeVisible();
  return dialog;
}

/** The `<label>` whose text is `text`, with or without the required mark. */
const labelOf = (dialog: Locator, text: string) => dialog.locator("label").filter({ hasText: fieldLabel(text) });

async function expectRequired(dialog: Locator, text: string) {
  const mark = labelOf(dialog, text).locator('[aria-hidden="true"]', { hasText: "*" });
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveText("*");
  await expect(mark).toHaveClass(/\btext-destructive\b/);
  await expect(dialog.getByLabel(fieldLabel(text))).toHaveAttribute("aria-required", "true");
}

async function expectOptional(dialog: Locator, text: string) {
  await expect(labelOf(dialog, text)).toHaveCount(1);
  await expect(labelOf(dialog, text)).not.toContainText("*");
  await expect(dialog.getByLabel(fieldLabel(text))).not.toHaveAttribute("aria-required", "true");
}

const ISSUE_DATE_HINT = "The day you passed the exam. The expiry date is worked out from its validity period.";

test("R10: Notes is in the admin and manager forms but not in a member's", async ({ page }) => {
  let dialog = await openAddForm(page);
  await expect(dialog.getByLabel("Notes", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.context().clearCookies();
  await signIn(page, "manager@certtracker.test");
  await page.goto("/records");
  await page.getByRole("button", { name: "Add certificate" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Notes", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.context().clearCookies();
  dialog = await openOwnForm(page);
  // Anchor on a field that is there, so a count of 0 cannot pass before the sheet has rendered.
  await expect(dialog.getByLabel(fieldLabel("Certificate"))).toBeVisible();
  await expect(dialog.getByLabel("Notes", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("Notes", { exact: true })).toHaveCount(0);
});

test("R11: the evidence upload is offered only for a Completed certificate", async ({ page }) => {
  const dialog = await openAddForm(page);
  const evidence = dialog.getByLabel("Evidence", { exact: true });

  await expect(dialog.getByLabel(fieldLabel("Planned exam date"))).toBeVisible();
  await expect(evidence).toHaveCount(0);
  await pickSelect(page, dialog, "Status", "In progress");
  await expect(dialog.getByLabel("Progress (%)")).toBeVisible();
  await expect(evidence).toHaveCount(0);
  await pickSelect(page, dialog, "Status", "Completed");
  await expect(evidence).toHaveCount(1);
  await pickSelect(page, dialog, "Status", "Not started");
  await expect(dialog.getByLabel(fieldLabel("Planned exam date"))).toBeVisible();
  await expect(evidence).toHaveCount(0);

  // Same rule in a member's own form.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.context().clearCookies();
  const own = await openOwnForm(page);
  await expect(own.getByLabel(fieldLabel("Planned exam date"))).toBeVisible();
  await expect(own.getByLabel("Evidence", { exact: true })).toHaveCount(0);
  await pickSelect(page, own, "Status", "Completed");
  await expect(own.getByLabel("Evidence", { exact: true })).toHaveCount(1);
});

test("R12: required fields carry a red star and aria-required; optional ones carry neither", async ({ page }) => {
  const dialog = await openAddForm(page);
  await expect(dialog.getByText(/^\*\s*Required$/)).toBeVisible();
  // Only "Course studied" carries the (optional) marker.
  await expect(dialog.getByText("(optional)")).toHaveCount(1);

  // Not started (the default).
  await expectRequired(dialog, "Member");
  await expectRequired(dialog, "Certificate");
  await expectRequired(dialog, "Status");
  await expectOptional(dialog, "Planned exam date");
  await expectOptional(dialog, "Notes");

  await pickSelect(page, dialog, "Status", "In progress");
  await expectRequired(dialog, "Progress (%)");
  await expectOptional(dialog, "Planned exam date");

  await pickSelect(page, dialog, "Status", "Completed");
  await expectRequired(dialog, "Date passed");
  await expectOptional(dialog, "Certificate link");
  await expectOptional(dialog, "Evidence");
  // Only "Course studied" carries the (optional) marker.
  await expect(dialog.getByText("(optional)")).toHaveCount(1);
});

test("R12: a member's form marks Certificate and Status, and has no Member picker", async ({ page }) => {
  const dialog = await openOwnForm(page);
  await expect(dialog.getByText(/^\*\s*Required$/)).toBeVisible();
  await expectRequired(dialog, "Certificate");
  await expectRequired(dialog, "Status");
  await expect(labelOf(dialog, "Member")).toHaveCount(0);
});

test("R18: the Completed form explains that Date passed is not the expiry date", async ({ page }) => {
  const dialog = await openAddForm(page);
  const hint = dialog.getByText(ISSUE_DATE_HINT, { exact: true });

  await expect(dialog.getByLabel(fieldLabel("Planned exam date"))).toBeVisible();
  await expect(hint).toHaveCount(0);
  await pickSelect(page, dialog, "Status", "Completed");
  await expect(hint).toBeVisible();
  // Under the Date passed field: below its input, above the Certificate link.
  const issued = await dialog.getByLabel(fieldLabel("Date passed")).boundingBox();
  const link = await dialog.getByLabel(fieldLabel("Certificate link")).boundingBox();
  const box = await hint.boundingBox();
  expect(box!.y).toBeGreaterThan(issued!.y);
  expect(box!.y).toBeLessThan(link!.y);
  await pickSelect(page, dialog, "Status", "In progress");
  await expect(hint).toHaveCount(0);
});

test("R16: a live update while the sheet is open does not bring back an issue date the status switch cleared", async ({ page }) => {
  const AN = "5eed0000-0000-0000-0000-00000000b001";
  const AWS_ID = "5eed0000-0000-0000-0000-00000000e001";
  const admin = await signInAsSeedAdmin();
  const { data: before, error } = await admin.from("training_records").select("notes").eq("member_id", AN).eq("certificate_id", AWS_ID).single();
  if (error) throw new Error(`read An's note: ${error.message}`);
  const marker = `live update ${Date.now()}`;

  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");
  const row = page.getByRole("row").filter({ hasText: "Nguyễn Văn An" }).filter({ hasText: "AWS Solutions Architect Associate" });
  await row.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(fieldLabel("Date passed"))).not.toHaveValue("");
  try {
    await pickSelect(page, dialog, "Status", "In progress");
    await expect(dialog.getByLabel(fieldLabel("Date passed"))).toHaveCount(0);

    // Someone else edits the same certificate; Realtime refreshes the open sheet (the untouched Notes shows it).
    const { error: updateError } = await admin.from("training_records").update({ notes: marker }).eq("member_id", AN).eq("certificate_id", AWS_ID);
    if (updateError) throw new Error(`update An's note: ${updateError.message}`);
    await expect(dialog.getByLabel("Notes", { exact: true })).toHaveValue(marker, { timeout: 15_000 });

    await pickSelect(page, dialog, "Status", "Completed");
    await expect(dialog.getByLabel(fieldLabel("Date passed"))).toHaveValue("");
  } finally {
    await dialog.getByRole("button", { name: "Cancel" }).click();
    const { error: restoreError } = await admin.from("training_records").update({ notes: before.notes }).eq("member_id", AN).eq("certificate_id", AWS_ID);
    if (restoreError) throw new Error(`restore An's note: ${restoreError.message}`);
  }
});

test("a member sees Course studied up front, and an exam without a preparing course says so", async ({ page }) => {
  const admin = await signInAsSeedAdmin();
  const name = `QA Exam ${Date.now()}`;
  const created = await admin
    .from("certificates")
    .insert({
      name,
      kind: "exam",
      cert_type_id: "5eed0000-0000-0000-0000-00000000c001",
      provider_id: "5eed0000-0000-0000-0000-00000000c101",
      validity_months: 12,
    })
    .select("id")
    .single();
  if (created.error) throw new Error(`create QA exam: ${created.error.message}`);
  try {
    const dialog = await openOwnForm(page);
    const studied = dialog.getByLabel(fieldLabel("Course studied"));
    await expect(studied).toBeDisabled();
    await expect(dialog.getByText("Choose the exam first.")).toBeVisible();

    await dialog.getByLabel(fieldLabel("Certificate")).fill(name);
    await page.getByRole("option", { name: `${name}` }).click();
    await expect(studied).toBeDisabled();
    await expect(studied).toContainText("None (self-study)");
    await expect(dialog.getByText("No course is listed for this exam. That's fine.")).toBeVisible();
  } finally {
    const removed = await admin.from("certificates").delete().eq("id", created.data.id);
    if (removed.error) throw new Error(`remove QA exam: ${removed.error.message}`);
  }
});

test("Add mode hints: Completed for a passed exam, what the link is, what the evidence is and who sees it", async ({ page }) => {
  const dialog = await openAddForm(page);
  await expect(dialog.getByText("Already passed it? Choose Completed to add the date and your proof.")).toBeVisible();
  await expect(dialog.getByLabel(fieldLabel("Status"))).toContainText("Not started");
  await pickSelect(page, dialog, "Status", "Completed");
  await expect(dialog.getByLabel(fieldLabel("Certificate link"))).toHaveAccessibleDescription("Link to the public badge or verification page.");
  await expect(dialog.getByText(/^Upload a scan or screenshot \(PDF\/image up to 4 MB\)\. Only the member, their managers and admins can see it\.$/)).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.context().clearCookies();
  const own = await openOwnForm(page);
  await pickSelect(page, own, "Status", "Completed");
  await expect(own.getByText("Only you, your managers and admins can see it.", { exact: false })).toBeVisible();
});

test("Refund status is disabled, and back to its default, while Registered through the company is off", async ({ page }) => {
  const dialog = await openAddForm(page);
  const refund = dialog.getByLabel("Refund status", { exact: true });
  await expect(refund).toBeDisabled();
  await dialog.getByRole("switch", { name: "Registered through the company" }).click();
  await expect(refund).toBeEnabled();
  await pickSelect(page, dialog, "Refund status", "Pending");
  await dialog.getByRole("switch", { name: "Registered through the company" }).click();
  await expect(refund).toBeDisabled();
  await expect(refund).toContainText("Not applicable");
});

test("editing a record shows its kind as text, not switchable tabs", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");
  await page.getByRole("row").filter({ hasText: "Lê Minh Châu" }).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(fieldLabel("Certificate"))).toBeVisible();
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.getByText("Exam certificate", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
});

test("progress typed while In progress comes back after a status round trip, and is saved", async ({ page }) => {
  const CHAU = "5eed0000-0000-0000-0000-00000000b003";
  const fixture = await createCompletionFixture();
  const admin = await signInAsSeedAdmin();
  try {
    const seeded = await admin.from("training_records").insert({ member_id: CHAU, certificate_id: fixture.certificateId, status: "in_progress", progress: 20 });
    if (seeded.error) throw new Error(`insert record: ${seeded.error.message}`);

    await signIn(page, "admin@certtracker.test");
    await page.goto("/records");
    const row = page.getByRole("row").filter({ hasText: fixture.certificateName });
    await row.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Progress (%)").fill("75");
    await pickSelect(page, dialog, "Status", "Not started");
    await expect(dialog.getByLabel("Progress (%)")).toHaveCount(0);
    await pickSelect(page, dialog, "Status", "In progress");
    await expect(dialog.getByLabel("Progress (%)")).toHaveValue("75");

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await admin.from("training_records").select("progress").eq("certificate_id", fixture.certificateId).single()).data?.progress).toBe(75);
    await expect(row).toContainText("75%");
  } finally {
    await fixture.remove();
  }
});
