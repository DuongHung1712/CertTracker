import { expect, test, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";
import { recordRow } from "./support/pilot-member";
import { signInAsSeedAdmin } from "./support/restore-seed";

const AWS_EXAM = "AWS Solutions Architect Associate";
const NVIDIA_EXAM = "NVIDIA Generative AI LLMs";
const NVIDIA_COURSE = "NVIDIA Generative AI LLMs";
const NVIDIA_PROVIDER = "NVIDIA";

const CHAU = "5eed0000-0000-0000-0000-00000000b003";
const AWS_ID = "5eed0000-0000-0000-0000-00000000e001";

/** Restore Châu to seed state: one self-study item for AWS, no certificate records. */
async function restoreChau() {
  const admin = await signInAsSeedAdmin();
  const records = await admin.from("training_records").select("evidence_path").eq("member_id", CHAU);
  if (records.error) throw new Error(`read Châu certificates: ${records.error.message}`);
  const files = records.data.flatMap((r) => (r.evidence_path ? [r.evidence_path] : []));
  if (files.length > 0) await admin.storage.from("certificates").remove(files);
  const removed = await admin.from("training_records").delete().eq("member_id", CHAU);
  if (removed.error) throw new Error(`remove Châu certificates: ${removed.error.message}`);
  const cleared = await admin.from("learning_items").delete().eq("member_id", CHAU);
  if (cleared.error) throw new Error(`clear Châu items: ${cleared.error.message}`);
  const seeded = await admin.from("learning_items").insert({
    member_id: CHAU,
    target_certificate_id: AWS_ID,
    status: "not_started",
    progress: 0,
  });
  if (seeded.error) throw new Error(`seed Châu item: ${seeded.error.message}`);
}

test.beforeEach(restoreChau);
test.afterEach(restoreChau);

async function openRowMenu(page: Page, rowText: string, item: string) {
  await expect(async () => {
    await page.keyboard.press("Escape");
    await recordRow(page, rowText).getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: item }).click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test.describe("Learning goal", () => {
  test("(a) member adds a self-study exam item; row shows exam with Exam badge and Self-study", async ({ page }) => {
    await signIn(page, "member@certtracker.test");
    await page.goto("/me?tab=learning");

    await page.getByRole("button", { name: "Add learning" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Add learning" })).toBeVisible();

    // "An exam" tab is default
    await expect(sheet.getByRole("tab", { name: "An exam" })).toHaveAttribute("aria-selected", "true");

    // Select exam
    await sheet.getByLabel(fieldLabel("Exam")).click();
    await page.getByRole("option", { name: new RegExp(NVIDIA_EXAM) }).click();

    // Verify course field is optional with self-study placeholder
    await expect(sheet.getByRole("combobox", { name: fieldLabel("Course") })).toHaveAttribute(
      "placeholder",
      "Self-study (no course)",
    );

    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toHaveCount(0);

    // Verify table row displays exam name, Exam badge, and "Self-study"
    const row = recordRow(page, NVIDIA_EXAM);
    await expect(row).toBeVisible();
    await expect(row.getByText(NVIDIA_EXAM)).toBeVisible();
    await expect(row.getByText("Exam", { exact: true })).toBeVisible();
    await expect(row.getByText("Self-study", { exact: true })).toBeVisible();

    // Clean up via UI
    await openRowMenu(page, NVIDIA_EXAM, "Delete");
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Remove this item?" })).toBeVisible();
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(recordRow(page, NVIDIA_EXAM)).toHaveCount(0);
  });

  test("(b) member adds a course item; row shows course with Course badge and provider completion certificate", async ({
    page,
  }) => {
    await signIn(page, "member@certtracker.test");
    await page.goto("/me?tab=learning");

    await page.getByRole("button", { name: "Add learning" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Add learning" })).toBeVisible();

    // Switch to "A course" tab
    await sheet.getByRole("tab", { name: "A course" }).click();
    await expect(sheet.getByRole("tab", { name: "A course" })).toHaveAttribute("aria-selected", "true");

    // Select course
    await sheet.getByLabel(fieldLabel("Course")).click();
    await page.getByRole("option", { name: new RegExp(NVIDIA_COURSE) }).click();

    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toHaveCount(0);

    // Verify table row displays course name, Course badge, and "<provider> · course certificate"
    const row = recordRow(page, NVIDIA_COURSE);
    await expect(row).toBeVisible();
    await expect(row.getByText(NVIDIA_COURSE)).toBeVisible();
    await expect(row.getByText("Course", { exact: true })).toBeVisible();
    await expect(row.getByText(`${NVIDIA_PROVIDER} · course certificate`)).toBeVisible();

    // Clean up via UI
    await openRowMenu(page, NVIDIA_COURSE, "Delete");
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Remove this item?" })).toBeVisible();
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(recordRow(page, NVIDIA_COURSE)).toHaveCount(0);
  });

  test("(c) choosing an exam that already has an open item shows duplicate error and disables Save", async ({
    page,
  }) => {
    await signIn(page, "member@certtracker.test");
    await page.goto("/me?tab=learning");

    // Verify the open item exists in table
    await expect(recordRow(page, AWS_EXAM)).toBeVisible();

    await page.getByRole("button", { name: "Add learning" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Add learning" })).toBeVisible();

    // "An exam" tab is default
    await expect(sheet.getByRole("tab", { name: "An exam" })).toHaveAttribute("aria-selected", "true");

    // Select the exam that already has an open item
    await sheet.getByLabel(fieldLabel("Exam")).click();
    await page.getByRole("option", { name: new RegExp(AWS_EXAM) }).click();

    // Verify duplicate error alert and disabled Save button
    await expect(sheet.getByRole("alert")).toHaveText(
      `You already have an open item for ${AWS_EXAM}. Edit it instead.`,
    );
    await expect(sheet.getByRole("button", { name: "Save" })).toBeDisabled();

    // Cancel to close
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await expect(sheet).toHaveCount(0);
  });

  test("(d) editing a course-only item opens on 'A course' tab with no Exam field", async ({ page }) => {
    await signIn(page, "member@certtracker.test");
    await page.goto("/me?tab=learning");

    // First create a course-only item
    await page.getByRole("button", { name: "Add learning" }).click();
    const addSheet = page.getByRole("dialog");
    await addSheet.getByRole("tab", { name: "A course" }).click();
    await addSheet.getByLabel(fieldLabel("Course")).click();
    await page.getByRole("option", { name: new RegExp(NVIDIA_COURSE) }).click();
    await addSheet.getByRole("button", { name: "Save" }).click();
    await expect(addSheet).toHaveCount(0);
    await expect(recordRow(page, NVIDIA_COURSE)).toBeVisible();

    // Edit the course-only item
    await openRowMenu(page, NVIDIA_COURSE, "Edit");
    const editSheet = page.getByRole("dialog");
    await expect(editSheet.getByRole("heading", { name: "Edit learning" })).toBeVisible();

    // Verify it opens on "A course" tab
    await expect(editSheet.getByRole("tab", { name: "A course" })).toHaveAttribute("aria-selected", "true");

    // Verify no Exam field is present
    await expect(editSheet.getByLabel(/^Exam/)).toHaveCount(0);
    await expect(editSheet.getByRole("combobox", { name: /^Exam/ })).toHaveCount(0);

    // Verify Course field is present
    await expect(editSheet.getByLabel(fieldLabel("Course"))).toBeVisible();

    await editSheet.getByRole("button", { name: "Cancel" }).click();
    await expect(editSheet).toHaveCount(0);

    // Clean up via UI
    await openRowMenu(page, NVIDIA_COURSE, "Delete");
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Remove this item?" })).toBeVisible();
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(recordRow(page, NVIDIA_COURSE)).toHaveCount(0);
  });
});
