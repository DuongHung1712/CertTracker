import { expect, test, type Locator, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";

// The form is opened and cancelled only: nothing is saved, so the seed stays untouched. Decision #72: a certificate is a
// result, always Completed, so the form has no Status, Progress, planned date or preparation course (those belong to a
// learning item, see learning-items.spec.ts); the tests about switching status were removed with them.

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
  await expect(dialog.getByLabel(fieldLabel("Certificate"))).toBeVisible();
  return dialog;
}

async function expectFields(dialog: Locator, shown: string[], hidden: string[]) {
  for (const label of shown) await expect(dialog.getByLabel(fieldLabel(label))).toBeVisible();
  for (const label of hidden) await expect(dialog.getByLabel(fieldLabel(label))).toHaveCount(0);
}

test("the form has the fields of a passed certificate and no journey fields", async ({ page }) => {
  const dialog = await openAddForm(page);
  await expectFields(
    dialog,
    ["Date passed", "Certificate link", "Evidence"],
    ["Status", "Progress (%)", "Planned exam date", "Preparation course"],
  );
  // An admin gets a way to fix a missing certificate; the member's hint is covered in records.spec.ts.
  await expect(dialog.getByRole("link", { name: "Add it in the Catalogue" })).toHaveAttribute("href", "/courses");
});

test("typing digits in a date field inserts the slashes", async ({ page }) => {
  const dialog = await openAddForm(page);

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

// ROUND 2: R10, R11, R12, R16, R18.

async function openOwnForm(page: Page): Promise<Locator> {
  await signIn(page, "member@certtracker.test");
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(fieldLabel("Certificate"))).toBeVisible();
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

test("R11: the evidence upload is offered in the admin form and in a member's own form", async ({ page }) => {
  const dialog = await openAddForm(page);
  await expect(dialog.getByLabel("Evidence", { exact: true })).toHaveCount(1);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.context().clearCookies();
  const own = await openOwnForm(page);
  await expect(own.getByLabel("Evidence", { exact: true })).toHaveCount(1);
});

test("R12: required fields carry a red star and aria-required; optional ones carry neither", async ({ page }) => {
  const dialog = await openAddForm(page);
  await expect(dialog.getByText(/^\*\s*Required$/)).toBeVisible();
  await expect(dialog.getByText("(optional)")).toHaveCount(0);

  await expectRequired(dialog, "Member");
  await expectRequired(dialog, "Certificate");
  await expectRequired(dialog, "Date passed");
  await expectOptional(dialog, "Certificate link");
  await expectOptional(dialog, "Evidence");
  await expectOptional(dialog, "Notes");
});

test("R12: a member's form marks Certificate and Date passed, and has no Member picker", async ({ page }) => {
  const dialog = await openOwnForm(page);
  await expect(dialog.getByText(/^\*\s*Required$/)).toBeVisible();
  await expectRequired(dialog, "Certificate");
  await expectRequired(dialog, "Date passed");
  await expect(labelOf(dialog, "Member")).toHaveCount(0);
});

test("R18: the form explains that Date passed is not the expiry date", async ({ page }) => {
  const dialog = await openAddForm(page);
  const hint = dialog.getByText(ISSUE_DATE_HINT, { exact: true });
  await expect(hint).toBeVisible();
  // Under the Date passed field: below its input, above the Certificate link.
  const issued = await dialog.getByLabel(fieldLabel("Date passed")).boundingBox();
  const link = await dialog.getByLabel(fieldLabel("Certificate link")).boundingBox();
  const box = await hint.boundingBox();
  expect(box!.y).toBeGreaterThan(issued!.y);
  expect(box!.y).toBeLessThan(link!.y);
});

test("Add mode hints: what the link is, what the evidence is and who sees it", async ({ page }) => {
  const dialog = await openAddForm(page);
  await expect(dialog.getByLabel(fieldLabel("Certificate link"))).toHaveAccessibleDescription("Link to the public certificate or verification page.");
  await expect(dialog.getByText(/^Upload a scan or screenshot \(PDF\/image up to 4 MB\)\. Only the member, their managers and admins can see it\.$/)).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.context().clearCookies();
  const own = await openOwnForm(page);
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
  await page.getByRole("row").filter({ hasText: "Nguyễn Văn An" }).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(fieldLabel("Certificate"))).toBeVisible();
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.getByText("Exam certificate", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
});
