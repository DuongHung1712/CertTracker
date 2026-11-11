import { expect, test, type Locator, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";

const ADMIN = "admin@certtracker.test";
const MEMBER = "member@certtracker.test";
const MANAGER = "manager@certtracker.test";

async function openTab(page: Page, name: "Certificates" | "Courses") {
  await page.getByRole("tab", { name }).click();
}

async function signOut(page: Page) {
  // "Sign out" is a menu item behind the "Account" trigger (src/components/app-shell/user-menu.tsx).
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
}

async function pickOption(page: Page, dialog: Locator, label: string | RegExp, option: string) {
  await dialog.getByLabel(label).click();
  // Exact name: a closing popup can still be visible when the next one opens.
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function addCertificate(page: Page, fields: { name: string; kind: "Exam" | "Course completion" }) {
  await openTab(page, "Certificates");
  await page.getByRole("button", { name: "Add certificate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await pickOption(page, dialog, fieldLabel("Kind"), fields.kind);
  await dialog.getByLabel(fieldLabel("Name")).fill(fields.name);
  await pickOption(page, dialog, fieldLabel("Certificate type"), "Cloud");
  await pickOption(page, dialog, fieldLabel("Provider"), "AWS");
  return dialog;
}

async function fillCourseBasics(page: Page, courseName: string) {
  await page.getByRole("button", { name: "Add course" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(fieldLabel("Name")).fill(courseName);
  await pickOption(page, dialog, fieldLabel("Provider"), "AWS");
  return dialog;
}

async function addCourse(page: Page, name: string, preparesFor?: string) {
  await openTab(page, "Courses");
  const dialog = await fillCourseBasics(page, name);
  if (preparesFor) await pickOption(page, dialog, "Prepares for", preparesFor);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
}

/** Narrows the visible tab to one row, so the check does not depend on pagination as rows pile up. */
async function searchFor(page: Page, text: string) {
  await page.getByRole("searchbox").fill(text);
}

// exact: the row's actions button is aria-labelled "Actions for {name}", so a substring match also hits that cell.
const rowOf = (page: Page, name: string) =>
  page.getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) });

/** Both tabs list rows but offer no add, edit or delete, and the admin-only reference sections are absent. */
async function expectReadOnlyCatalogue(page: Page, names?: { examName: string; courseName: string }) {
  await page.goto("/courses");
  await expect(page.getByRole("row").nth(1)).toBeVisible();
  if (names) {
    await searchFor(page, names.examName);
    await expect(rowOf(page, names.examName)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Add certificate", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Actions for / })).toHaveCount(0);
  await openTab(page, "Courses");
  await expect(page.getByRole("row").nth(1)).toBeVisible();
  if (names) {
    await searchFor(page, names.courseName);
    await expect(rowOf(page, names.courseName)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Add course" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Actions for / })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Certificate types" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Providers" })).toHaveCount(0);
}

test("admin adds an exam certificate and a course that prepares for it; a member only reads both", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Catalogue" }).click();
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();

  const stamp = Date.now();
  const examName = `Exam E2E ${stamp}`;
  const courseName = `Course E2E ${stamp}`;
  const certificateDialog = await addCertificate(page, { name: examName, kind: "Exam" });
  await certificateDialog.getByRole("button", { name: "Save" }).click();
  await expect(certificateDialog).toBeHidden();
  await expect(rowOf(page, examName).getByText("Exam", { exact: true })).toBeVisible();
  await expect(rowOf(page, examName).getByText("No expiry")).toBeVisible();

  await addCourse(page, courseName, examName);
  await expect(rowOf(page, courseName).getByRole("cell", { name: examName, exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, MEMBER);
  await expectReadOnlyCatalogue(page, { examName, courseName });
});

test("a manager reads the catalogue without any way to change it", async ({ page }) => {
  await signIn(page, MANAGER);
  await expectReadOnlyCatalogue(page);
});

test("a course completion needs a granting course, and that course cannot be deleted while it grants", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");

  const stamp = Date.now();
  const courseName = `Granting Course ${stamp}`;
  const completionName = `Completion E2E ${stamp}`;
  await addCourse(page, courseName);

  const dialog = await addCertificate(page, { name: completionName, kind: "Course completion" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Choose the course that grants this completion")).toBeVisible();
  await pickOption(page, dialog, fieldLabel("Course"), courseName);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(rowOf(page, completionName).getByRole("cell", { name: courseName, exact: true })).toBeVisible();
  await expect(page.getByText(`Added course completion ${completionName}`)).toBeVisible();

  // A completion is never called a certificate, also when deleting it.
  await rowOf(page, completionName).getByRole("button", { name: `Actions for ${completionName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog").getByText(`Delete course completion ${completionName}?`)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await openTab(page, "Courses");
  await expect(rowOf(page, courseName).getByText(`Completion: ${completionName}`)).toBeVisible();

  // A course that grants a completion is no longer offered to the next one; a free course still is.
  const next = await addCertificate(page, { name: `Next ${stamp}`, kind: "Course completion" });
  await next.getByLabel(fieldLabel("Course")).click();
  await expect(page.getByRole("option", { name: "AWS Solutions Architect Associate", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: courseName, exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(next).toBeHidden();
  await openTab(page, "Courses");

  await rowOf(page, courseName).getByRole("button", { name: `Actions for ${courseName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete course" }).click();
  await expect(
    page.getByText(`This course grants the completion ${completionName}. Delete or change that completion first.`),
  ).toBeVisible();
});

test("admin saves a course with a USD cost and study hours, and the list shows them", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");

  const courseName = `Priced Course ${Date.now()}`;
  const dialog = await fillCourseBasics(page, courseName);
  await dialog.getByLabel("Cost", { exact: true }).fill("150");
  await dialog.getByLabel("Currency", { exact: true }).click();
  await page.getByRole("option", { name: "USD", exact: true }).click();
  await dialog.getByLabel("Duration (hours)").fill("40");
  await dialog.getByRole("button", { name: "Save" }).click();
  // Wait for the sheet to close: while it is open Radix marks the table aria-hidden and row queries find nothing.
  await expect(dialog).toBeHidden();

  await searchFor(page, courseName);
  const row = rowOf(page, courseName);
  await expect(row.getByRole("cell", { name: "$150", exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "40", exact: true })).toBeVisible();
});

test("a cost without a currency is refused with a clear message", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");

  const dialog = await fillCourseBasics(page, `Unpriced Course ${Date.now()}`);
  await dialog.getByLabel("Cost", { exact: true }).fill("150");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Choose a currency for the cost")).toBeVisible();
});

test("admin records refund conditions on a refundable course", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");

  const courseName = `Refund Course ${Date.now()}`;
  const text = "Pass the exam within 6 months";
  const dialog = await fillCourseBasics(page, courseName);
  await expect(dialog.getByLabel("Duration (hours)")).toBeVisible();
  await expect(dialog.getByLabel("Study hours (estimate)")).toHaveCount(0);
  await expect(dialog.getByLabel("Refund conditions")).toHaveCount(0);
  await dialog.getByRole("switch", { name: "Refundable" }).click();
  await dialog.getByLabel("Refund conditions").fill(text);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await searchFor(page, courseName);
  const row = rowOf(page, courseName);
  await expect(row.getByText(text)).toBeVisible();

  await row.getByRole("button", { name: `Actions for ${courseName}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog");
  await edit.getByRole("switch", { name: "Refundable" }).click();
  await expect(edit.getByLabel("Refund conditions")).toHaveCount(0);
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toBeHidden();

  await row.getByRole("button", { name: `Actions for ${courseName}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const again = page.getByRole("dialog");
  await expect(again.getByLabel("Refund conditions")).toHaveCount(0);
  await again.getByRole("switch", { name: "Refundable" }).click();
  await expect(again.getByLabel("Refund conditions")).toHaveValue("");
});
