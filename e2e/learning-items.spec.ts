import { expect, test, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";
import { recordRow } from "./support/pilot-member";
import { signInAsSeedAdmin } from "./support/restore-seed";

// Decision #72: the journey is a learning item; the certificate is a result that waits for approval.
const AWS = "AWS Solutions Architect Associate";
const COURSE = "NVIDIA Generative AI LLMs";
const CHAU = "5eed0000-0000-0000-0000-00000000b003";
const AWS_ID = "5eed0000-0000-0000-0000-00000000e001";

/** Châu back to the seed: one self-study item for AWS, no AWS certificate. */
async function restoreChau() {
  const admin = await signInAsSeedAdmin();
  const records = await admin.from("training_records").select("evidence_path").eq("member_id", CHAU).eq("certificate_id", AWS_ID);
  if (records.error) throw new Error(`read Châu certificates: ${records.error.message}`);
  const files = records.data.flatMap((r) => (r.evidence_path ? [r.evidence_path] : []));
  if (files.length > 0) await admin.storage.from("certificates").remove(files);
  const removed = await admin.from("training_records").delete().eq("member_id", CHAU).eq("certificate_id", AWS_ID);
  if (removed.error) throw new Error(`remove Châu certificate: ${removed.error.message}`);
  const cleared = await admin.from("learning_items").delete().eq("member_id", CHAU);
  if (cleared.error) throw new Error(`clear Châu items: ${cleared.error.message}`);
  const seeded = await admin.from("learning_items").insert({ member_id: CHAU, target_certificate_id: AWS_ID, status: "not_started", progress: 0 });
  if (seeded.error) throw new Error(`seed Châu item: ${seeded.error.message}`);
}

test.beforeEach(restoreChau);
test.afterEach(restoreChau);

const heldValue = (page: Page) =>
  page.locator("dl > div").filter({ has: page.getByText("Valid", { exact: true }) }).locator("dd").first();

async function openRowMenu(page: Page, rowText: string, item: string) {
  await expect(async () => {
    await page.keyboard.press("Escape");
    await recordRow(page, rowText).getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: item }).click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test("self-study for an exam, submit the certificate, manager approves: only then it is held", async ({ browser }) => {
  test.setTimeout(120_000);
  const memberContext = await browser.newContext();
  const managerContext = await browser.newContext();
  try {
    const member = await memberContext.newPage();
    const manager = await managerContext.newPage();
    await signIn(member, "member@certtracker.test");
    await signIn(manager, "manager@certtracker.test");
    await expect(heldValue(member)).toHaveText("0");

    // The plan is a learning item on the Learning tab.
    await member.goto("/me?tab=learning");
    await expect(recordRow(member, AWS)).toContainText("Not started");

    // Passed: submit the certificate from the item.
    await openRowMenu(member, AWS, "Submit certificate");
    const dialog = member.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add certificate" })).toBeVisible();
    await dialog.getByLabel(fieldLabel("Date passed")).fill("01/06/2026");
    await dialog.getByLabel("Evidence", { exact: true }).setInputFiles("e2e/fixtures/evidence.pdf");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(member.getByText("Added certificate. It is waiting for approval.")).toBeVisible();
    await expect(recordRow(member, AWS)).toContainText("Completed");

    // Not held while it waits; the manager approves it.
    await member.goto("/dashboard");
    await expect(heldValue(member)).toHaveText("0");
    await manager.goto("/records?approval=waiting");
    await expect(recordRow(manager, "Lê Minh Châu", AWS)).toBeVisible();
    await openRowMenu(manager, AWS, "Approve");
    await expect(manager.getByText(/^Approved /)).toBeVisible();
    await member.goto("/dashboard");
    await expect(heldValue(member)).toHaveText("1");

    // A course the member follows is never counted as held.
    await member.goto("/me?tab=learning");
    await member.getByRole("button", { name: "Add learning" }).click();
    const sheet = member.getByRole("dialog");
    await sheet.getByLabel(fieldLabel("Course")).click();
    await member.getByRole("option", { name: new RegExp(COURSE) }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(recordRow(member, COURSE)).toBeVisible();
    await member.goto("/dashboard");
    await expect(heldValue(member)).toHaveText("1");
  } finally {
    await memberContext.close();
    await managerContext.close();
  }
});
