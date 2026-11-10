import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test("admin adds a course and a member can only read it", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/courses");

  const courseName = `Course E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Add course" }).click();
  // Scoped to the dialog: the table's FilterBar search box has aria-label "Search by name, type or provider…",
  // whose substring match on "Provider" collides with the sheet's own field under an unscoped getByLabel.
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Course name").fill(courseName);
  await dialog.getByLabel("Certificate type").click();
  // Pick by exact name, not `.first()`: the first select's popup can still be animating out (visible) when the
  // second one opens, so a bare `getByRole("option").first()` may resolve to an option of the wrong list.
  await page.getByRole("option", { name: "Cloud", exact: true }).click();
  await dialog.getByLabel("Provider").click();
  await page.getByRole("option", { name: "AWS", exact: true }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  // exact: the row's actions button is aria-labelled "Actions for {course name}", so an
  // unscoped substring match on the course name also matches that cell.
  await expect(page.getByRole("cell", { name: courseName, exact: true })).toBeVisible();

  // "Sign out" is a menu item behind the "Account" trigger (src/components/app-shell/user-menu.tsx), not a plain button — see e2e/auth.spec.ts for the same two-step pattern.
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await signIn(page, "member@certtracker.test");
  await page.goto("/courses");
  await expect(page.getByRole("cell", { name: courseName, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add course" })).toHaveCount(0);
});

async function fillCourseBasics(page: Page, courseName: string) {
  await page.getByRole("button", { name: "Add course" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Course name").fill(courseName);
  await dialog.getByLabel("Certificate type").click();
  await page.getByRole("option", { name: "Cloud", exact: true }).click();
  await dialog.getByLabel("Provider").click();
  await page.getByRole("option", { name: "AWS", exact: true }).click();
  return dialog;
}

test("admin saves a course with a USD cost and study hours, and the list shows them", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/courses");

  const courseName = `Priced Course ${Date.now()}`;
  const dialog = await fillCourseBasics(page, courseName);
  await dialog.getByLabel("Cost", { exact: true }).fill("150");
  await dialog.getByLabel("Currency", { exact: true }).click();
  await page.getByRole("option", { name: "USD", exact: true }).click();
  await dialog.getByLabel("Duration (hours)").fill("40");
  await dialog.getByRole("button", { name: "Save" }).click();
  // Wait for the sheet to close: while it is open Radix marks the table aria-hidden and row queries find nothing.
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: courseName, exact: true }) });
  await expect(row.getByRole("cell", { name: "$150", exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "40", exact: true })).toBeVisible();
});

test("a cost without a currency is refused with a clear message", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/courses");

  const dialog = await fillCourseBasics(page, `Unpriced Course ${Date.now()}`);
  await dialog.getByLabel("Cost", { exact: true }).fill("150");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Choose a currency for the cost")).toBeVisible();
});

test("admin records refund conditions on a refundable course", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/courses");

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

  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: courseName, exact: true }) });
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
