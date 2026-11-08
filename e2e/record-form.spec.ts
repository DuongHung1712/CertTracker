import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// The form is opened and cancelled only: nothing is saved, so the seed stays untouched.

/** Picks a value in a Base UI `Select`; its listbox is portalled outside the dialog. */
async function pickSelect(page: Page, dialog: Locator, label: string, optionName: string) {
  await dialog.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

async function openAddForm(page: Page): Promise<Locator> {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/records");
  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Status", { exact: true })).toBeVisible();
  return dialog;
}

async function expectFields(dialog: Locator, shown: string[], hidden: string[]) {
  for (const label of shown) await expect(dialog.getByLabel(label, { exact: true })).toBeVisible();
  for (const label of hidden) await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
}

test("the form shows the fields that belong to the chosen status", async ({ page }) => {
  const dialog = await openAddForm(page);

  // A new certificate starts as Not started.
  await expectFields(dialog, ["Planned exam date"], ["Progress (%)", "Issue date", "Certificate link"]);

  await pickSelect(page, dialog, "Status", "In progress");
  await expectFields(dialog, ["Progress (%)", "Planned exam date"], ["Issue date", "Certificate link"]);

  await pickSelect(page, dialog, "Status", "Completed");
  await expectFields(dialog, ["Issue date", "Certificate link"], ["Progress (%)", "Planned exam date"]);

  await pickSelect(page, dialog, "Status", "Not started");
  await expectFields(dialog, ["Planned exam date"], ["Progress (%)", "Issue date", "Certificate link"]);
});

test("switching status resets progress and clears the dates that no longer apply", async ({ page }) => {
  const dialog = await openAddForm(page);

  await pickSelect(page, dialog, "Status", "Completed");
  await dialog.getByLabel("Issue date", { exact: true }).fill("01/06/2026");
  await dialog.getByLabel("Certificate link").fill("https://example.com/cert");

  // Completed (100) -> In progress starts again from 0.
  await pickSelect(page, dialog, "Status", "In progress");
  await expect(dialog.getByLabel("Progress (%)")).toHaveValue("0");
  await dialog.getByLabel("Planned exam date", { exact: true }).fill("15/12/2026");

  // Back to Completed: the issue date and link were cleared when they were hidden.
  await pickSelect(page, dialog, "Status", "Completed");
  await expect(dialog.getByLabel("Issue date", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Certificate link")).toHaveValue("");

  // And the planned exam date was cleared on the way to Completed.
  await pickSelect(page, dialog, "Status", "In progress");
  await expect(dialog.getByLabel("Planned exam date", { exact: true })).toHaveValue("");
});

test("typing digits in a date field inserts the slashes", async ({ page }) => {
  const dialog = await openAddForm(page);
  await pickSelect(page, dialog, "Status", "Completed");

  const issued = dialog.getByLabel("Issue date", { exact: true });
  await issued.pressSequentially("01082026");
  await expect(issued).toHaveValue("01/08/2026");

  // Backspace removes digits without a slash getting stuck.
  await issued.press("Backspace");
  await issued.press("Backspace");
  await issued.press("Backspace");
  await issued.press("Backspace");
  await issued.press("Backspace");
  await expect(issued).toHaveValue("01/0");
});

test("the calendar button fills the date field as dd/mm/yyyy", async ({ page }) => {
  const dialog = await openAddForm(page);
  await pickSelect(page, dialog, "Status", "Completed");

  await expect(dialog.getByRole("button", { name: "Choose Issue date from calendar" })).toBeVisible();
  // Playwright cannot drive the browser's native date popup, so set the hidden date input the way the popup would.
  const picker = dialog.locator('input[type="date"]');
  await expect(picker).toHaveCount(1);
  await picker.evaluate((element: HTMLInputElement) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setValue.call(element, "2026-08-01");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(dialog.getByLabel("Issue date", { exact: true })).toHaveValue("01/08/2026");
});
