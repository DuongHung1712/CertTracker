import { expect, test, type Locator, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";
import { signInAsSeedAdmin } from "./support/restore-seed";

const ADD_CERTIFICATE_BUTTON = "Add certificate or course completion";
const ADMIN = "admin@certtracker.test";
const MEMBER = "member@certtracker.test";
const MANAGER = "manager@certtracker.test";

/** Names of the catalogue rows a test saves, so afterEach can remove them and the catalogue does not grow run after run. */
const created: string[] = [];
function track(name: string): string {
  created.push(name);
  return name;
}

test.afterEach(async () => {
  const names = created.splice(0);
  if (names.length === 0) return;
  const admin = await signInAsSeedAdmin();
  // Certificates first: a completion restricts the deletion of its granting course.
  const certificates = await admin.from("certificates").delete().in("name", names);
  if (certificates.error) throw new Error(`remove certificates: ${certificates.error.message}`);
  const courses = await admin.from("courses").delete().in("name", names);
  if (courses.error) throw new Error(`remove courses: ${courses.error.message}`);
});

async function openTab(page: Page, name: "Certificates" | "Courses") {
  await page.getByRole("tab", { name }).click();
}

async function signOut(page: Page) {
  // "Sign out" is a menu item behind the "Account" trigger (src/components/app-shell/user-menu.tsx).
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  // Wait for the redirect: going to /login while the sign-out action is still running leaves the session alive and /login bounces back.
  await expect(page).toHaveURL(/\/login/);
}

async function pickOption(page: Page, dialog: Locator, label: string | RegExp, option: string) {
  await dialog.getByLabel(label).click();
  // Exact name: a closing popup can still be visible when the next one opens.
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function addCertificate(page: Page, fields: { name: string; kind: "Exam" | "Course completion" }) {
  await openTab(page, "Certificates");
  await page.getByRole("button", { name: ADD_CERTIFICATE_BUTTON, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await pickOption(page, dialog, fieldLabel("Kind"), fields.kind);
  await dialog.getByLabel(fieldLabel("Name")).fill(fields.name);
  await pickOption(page, dialog, fieldLabel("Type"), "Cloud");
  await pickOption(page, dialog, fieldLabel("Provider"), "AWS");
  return dialog;
}

/** A plain course unless `grantsCompletion`: the switch is on by default (a course normally ends in a completion). */
async function fillCourseBasics(page: Page, courseName: string, grantsCompletion = false) {
  await page.getByRole("button", { name: "Add course" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(fieldLabel("Name")).fill(courseName);
  await pickOption(page, dialog, fieldLabel("Provider"), "AWS");
  if (!grantsCompletion) await dialog.getByRole("switch", { name: "This course grants a course certificate" }).click();
  return dialog;
}

async function addCourse(page: Page, name: string) {
  await openTab(page, "Courses");
  const dialog = await fillCourseBasics(page, name);
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
  await expect(page.getByRole("button", { name: ADD_CERTIFICATE_BUTTON, exact: true })).toHaveCount(0);
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

test("admin adds an exam certificate and a course; a member only reads both", async ({ page }) => {
  // Two sign-ins and two saves: past 30 s on CI's dev server.
  test.setTimeout(60_000);
  await signIn(page, ADMIN);
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Catalogue" }).click();
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();

  const stamp = Date.now();
  const examName = track(`Exam E2E ${stamp}`);
  const courseName = track(`Course E2E ${stamp}`);
  const certificateDialog = await addCertificate(page, { name: examName, kind: "Exam" });
  await certificateDialog.getByRole("button", { name: "Save" }).click();
  await expect(certificateDialog).toBeHidden();
  await searchFor(page, examName);
  await expect(rowOf(page, examName).getByText("Exam", { exact: true })).toBeVisible();
  await expect(rowOf(page, examName).getByText("No expiry")).toBeVisible();

  // Decision #72: a course no longer names the exam it prepares for; a learning item links the two.
  await addCourse(page, courseName);
  await searchFor(page, courseName);
  await expect(rowOf(page, courseName)).toBeVisible();

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
  const courseName = track(`Granting Course ${stamp}`);
  const completionName = track(`Completion E2E ${stamp}`);
  await addCourse(page, courseName);

  const dialog = await addCertificate(page, { name: completionName, kind: "Course completion" });
  await expect(dialog.getByRole("heading", { name: "Add course completion" })).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Choose the course that grants this completion")).toBeVisible();
  await pickOption(page, dialog, fieldLabel("Course"), courseName);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await searchFor(page, completionName);
  await expect(rowOf(page, completionName).getByRole("cell", { name: `Granted by: ${courseName}`, exact: true })).toBeVisible();
  await expect(page.getByText(`Added course completion ${completionName}`)).toBeVisible();

  // A completion is never called a certificate, also when deleting it.
  await rowOf(page, completionName).getByRole("button", { name: `Actions for ${completionName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog").getByText(`Delete course completion ${completionName}?`)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await openTab(page, "Courses");
  await searchFor(page, courseName);
  await expect(rowOf(page, courseName).getByRole("cell", { name: completionName, exact: true })).toBeVisible();

  // A course that grants a completion is no longer offered to the next one; a free course still is.
  const next = await addCertificate(page, { name: `Next ${stamp}`, kind: "Course completion" });
  await next.getByLabel(fieldLabel("Course")).click();
  await expect(page.getByRole("option", { name: "AWS Solutions Architect Associate", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: courseName, exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  // The sheet holds what was typed, so closing it asks first.
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard" }).click();
  await expect(next).toBeHidden();
  await openTab(page, "Courses");

  // The delete dialog names the completion, disables Delete and links to the Certificates tab.
  await searchFor(page, courseName);
  await rowOf(page, courseName).getByRole("button", { name: `Actions for ${courseName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByText(`This course grants the completion ${completionName}. Delete or change that completion first.`)).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Delete course" })).toBeDisabled();
  await confirm.getByRole("link", { name: "Open the Certificates tab" }).click();
  await expect(page.getByRole("tab", { name: "Certificates" })).toHaveAttribute("aria-selected", "true");
});

test("a course that grants nothing gets a plain delete confirmation that works", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  const courseName = track(`QA Plain Delete ${Date.now()}`);
  await addCourse(page, courseName);
  await searchFor(page, courseName);
  await rowOf(page, courseName).getByRole("button", { name: `Actions for ${courseName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByText(/This cannot be undone/)).toBeVisible();
  await expect(confirm.getByText(/grants the completion/)).toHaveCount(0);
  await confirm.getByRole("button", { name: "Delete course" }).click();
  await expect(page.getByText(`Deleted course ${courseName}`)).toBeVisible();
});

test("a completion form has no Validity field and saves without one; an exam keeps it", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  const stamp = Date.now();
  const courseName = track(`QA Validity Course ${stamp}`);
  const completionName = track(`QA Validity Completion ${stamp}`);
  await addCourse(page, courseName);

  const dialog = await addCertificate(page, { name: completionName, kind: "Course completion" });
  await expect(dialog.getByLabel("Validity (months)")).toHaveCount(0);
  await expect(dialog.getByLabel(fieldLabel("Link"))).toBeVisible();
  await expect(dialog.getByLabel("Certificate link")).toHaveCount(0);
  await pickOption(page, dialog, fieldLabel("Course"), courseName);
  await pickOption(page, dialog, fieldLabel("Kind"), "Exam");
  await expect(dialog.getByLabel("Validity (months)")).toBeVisible();
  await dialog.getByLabel("Validity (months)").fill("24");
  await pickOption(page, dialog, fieldLabel("Kind"), "Course completion");
  await expect(dialog.getByLabel("Validity (months)")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  const admin = await signInAsSeedAdmin();
  const saved = await admin.from("certificates").select("validity_months").eq("name", completionName).single();
  expect(saved.data?.validity_months).toBeNull();
});

test("the course sheet lists the cost and duration before the link, and says what is required", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");
  await page.getByRole("button", { name: "Add course" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("* Required")).toBeVisible();
  const ys = async (label: string | RegExp) => (await dialog.getByLabel(label, { exact: typeof label === "string" }).boundingBox())!.y;
  expect(await ys("Cost")).toBeLessThan(await ys("Course link"));
  await expect(dialog.getByLabel("Prepares for")).toHaveCount(0);
  expect(await ys("Duration (hours)")).toBeLessThan(await ys("Course link"));
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Provider is required")).toBeVisible();
});

test("a success toast sits at the top, away from the sheet's Save button, on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");
  const dialog = await fillCourseBasics(page, track(`QA Toast Course ${Date.now()}`));
  const save = await dialog.getByRole("button", { name: "Save" }).boundingBox();
  await dialog.getByRole("button", { name: "Save" }).click();
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  const box = (await toast.boundingBox())!;
  expect(box.y + box.height).toBeLessThan(save!.y);
});

test("admin saves a course with a USD cost and study hours, and the list shows them", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");

  const courseName = track(`Priced Course ${Date.now()}`);
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

  const dialog = await fillCourseBasics(page, track(`Unpriced Course ${Date.now()}`));
  await dialog.getByLabel("Cost", { exact: true }).fill("150");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Choose a currency for the cost")).toBeVisible();
});

test("admin records refund conditions on a refundable course", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");

  const courseName = track(`Refund Course ${Date.now()}`);
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

test("the selected tab lives in the URL, and the Courses actions stay on screen at 1280 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");
  await expect(page).toHaveURL(/\?tab=courses$/);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Courses" })).toHaveAttribute("aria-selected", "true");
  const actions = page.getByRole("button", { name: /^Actions for / }).first();
  await expect(actions).toBeInViewport({ ratio: 1 });

  await openTab(page, "Certificates");
  await expect(page).not.toHaveURL(/tab=/);
});

test("the link in the certificate sheet switches to the Courses tab", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await page.getByRole("button", { name: ADD_CERTIFICATE_BUTTON, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await pickOption(page, dialog, fieldLabel("Kind"), "Course completion");
  await dialog.getByRole("link", { name: /Courses tab/ }).click();
  await expect(page).toHaveURL(/\?tab=courses$/);
  await expect(page.getByRole("tab", { name: "Courses" })).toHaveAttribute("aria-selected", "true");
});

test("Escape closes only an open select popup; a second Escape closes the sheet", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await page.getByRole("button", { name: ADD_CERTIFICATE_BUTTON, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(fieldLabel("Name")).fill("Escape probe");
  await dialog.getByLabel(fieldLabel("Provider")).click();
  await expect(page.getByRole("option", { name: "AWS", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(fieldLabel("Name"))).toHaveValue("Escape probe");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("admin creates a course and its course completion in one step; a member and a manager see no add controls", async ({ page }) => {
  test.setTimeout(60_000); // creates a course, then signs in twice more: 30 s is too tight on a slow CI runner
  await signIn(page, ADMIN);
  await page.goto("/courses");
  await openTab(page, "Courses");
  const name = track(`QA One Step ${Date.now()}`);
  const dialog = await fillCourseBasics(page, name, true);
  // On by default: the completion fields show; switching off hides them; Escape resets the switch.
  const toggle = dialog.getByRole("switch", { name: "This course grants a course certificate" });
  await expect(toggle).toBeChecked();
  await expect(dialog.getByText("Leave empty to use the course name.")).toBeVisible();
  await toggle.click();
  await expect(dialog.getByLabel(fieldLabel("Completion type"))).toHaveCount(0);
  await toggle.click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Type is required")).toBeVisible();
  await pickOption(page, dialog, fieldLabel("Completion type"), "Cloud");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await searchFor(page, name);
  await expect(rowOf(page, name).getByRole("cell", { name, exact: true }).nth(1)).toBeVisible();
  await openTab(page, "Certificates");
  await searchFor(page, name);
  const certificate = rowOf(page, name);
  await expect(certificate.getByText("Course completion", { exact: true })).toBeVisible();

  // Edit mode of that course: read-only line, no switch.
  await openTab(page, "Courses");
  await searchFor(page, name);
  await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog");
  await expect(edit.getByText("Grants the course certificate")).toBeVisible();
  await expect(edit.getByRole("switch", { name: "This course grants a course certificate" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Closing a half-filled sheet resets the switch.
  await page.getByRole("button", { name: "Add course" }).click();
  const again = page.getByRole("dialog");
  await again.getByRole("switch", { name: "This course grants a course certificate" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard" }).click();
  await page.getByRole("button", { name: "Add course" }).click();
  await expect(page.getByRole("dialog").getByRole("switch", { name: "This course grants a course certificate" })).toBeChecked();
  await page.keyboard.press("Escape");

  await signOut(page);
  await signIn(page, MEMBER);
  await expectReadOnlyCatalogue(page);
  await page.goto("/courses");
  await expect(page.getByRole("button", { name: "Add course" })).toHaveCount(0);
});
