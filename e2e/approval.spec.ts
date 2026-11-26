import { expect, test, type Page } from "@playwright/test";
import { fieldLabel, signIn } from "./helpers";
import { recordRow } from "./support/pilot-member";
import { signInAsSeedAdmin, signInAsSeedUser } from "./support/restore-seed";

// E-11 and E-12 (spec 10.4). Châu (member@) submits the AWS certificate for the seed AWS item; the seed manager reviews it.
const AWS = "AWS Solutions Architect Associate";
const CHAU = "5eed0000-0000-0000-0000-00000000b003";
const AWS_ID = "5eed0000-0000-0000-0000-00000000e001";
const NOTE = "QA the date does not match the proof";

/** Châu back to the seed: one self-study AWS item, no AWS certificate (and no proof file). */
async function restoreChauAwsSeed() {
  const admin = await signInAsSeedAdmin();
  const records = await admin.from("training_records").select("evidence_path").eq("member_id", CHAU).eq("certificate_id", AWS_ID);
  if (records.error) throw new Error(`read Châu–AWS: ${records.error.message}`);
  const files = records.data.flatMap((r) => (r.evidence_path ? [r.evidence_path] : []));
  if (files.length > 0) {
    const removed = await admin.storage.from("certificates").remove(files);
    if (removed.error) throw new Error(`remove proof: ${removed.error.message}`);
  }
  const deleted = await admin.from("training_records").delete().eq("member_id", CHAU).eq("certificate_id", AWS_ID);
  if (deleted.error) throw new Error(`remove Châu–AWS: ${deleted.error.message}`);
  const cleared = await admin.from("learning_items").delete().eq("member_id", CHAU);
  if (cleared.error) throw new Error(`clear Châu items: ${cleared.error.message}`);
  const seeded = await admin.from("learning_items").insert({ member_id: CHAU, target_certificate_id: AWS_ID, status: "not_started", progress: 0 });
  if (seeded.error) throw new Error(`seed Châu item: ${seeded.error.message}`);
}

test.beforeEach(restoreChauAwsSeed);
test.afterEach(restoreChauAwsSeed);

async function openMenu(page: Page, name: string) {
  const row = recordRow(page, AWS);
  await expect(async () => {
    await page.keyboard.press("Escape");
    await row.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name }).click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

const heldValue = (page: Page) =>
  page.locator("dl > div").filter({ has: page.getByText("Valid", { exact: true }) }).locator("dd").first();
const waitingTile = (page: Page) => page.getByRole("link", { name: /Waiting for approval/ });

test("E-11: member submits, manager returns, member fixes, manager approves; numbers rise only then", async ({ browser }) => {
  test.setTimeout(120_000);
  const memberContext = await browser.newContext();
  const managerContext = await browser.newContext();
  try {
    const member = await memberContext.newPage();
    const manager = await managerContext.newPage();
    await signIn(member, "member@certtracker.test");
    await signIn(manager, "manager@certtracker.test");
    await expect(heldValue(member)).toHaveText("0");
    await expect(waitingTile(manager).getByText("0", { exact: true })).toBeVisible();

    // The member passes the exam planned on the Learning tab and adds the certificate with proof: it waits.
    await member.goto("/me?tab=learning");
    await openMenu(member, "Add certificate");
    const dialog = member.getByRole("dialog");
    await dialog.getByLabel(fieldLabel("Date passed")).fill("01/06/2026");
    await dialog.getByLabel("Evidence", { exact: true }).setInputFiles("e2e/fixtures/evidence.pdf");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(member.getByText("Added certificate. It is waiting for approval.")).toBeVisible();
    await member.goto("/me");
    await expect(recordRow(member, AWS)).toContainText("Waiting for approval");
    await member.goto("/dashboard");
    await expect(heldValue(member)).toHaveText("0");
    await expect(member.getByText("1 waiting for approval", { exact: true })).toBeVisible();
    await expect(member.getByRole("link", { name: "See waiting items" })).toHaveAttribute("href", "/me?view=waiting");

    // The manager finds it through the tile and the filter, and returns it with a note.
    await manager.goto("/dashboard");
    await expect(waitingTile(manager).getByText("1", { exact: true })).toBeVisible();
    // The dashboard is a client component: a click that lands while it hydrates can be dropped, so click again until it navigates.
    await expect(async () => {
      await waitingTile(manager).click();
      await expect(manager).toHaveURL(/\/records\?approval=waiting$/, { timeout: 3000 });
    }).toPass({ timeout: 15_000 });
    await expect(manager.getByRole("button", { name: "Waiting for approval (1)" })).toHaveAttribute("aria-pressed", "true");
    await expect(recordRow(manager, "Lê Minh Châu", AWS)).toBeVisible();
    await openMenu(manager, "Return");
    const returnDialog = manager.getByRole("alertdialog");
    await returnDialog.getByRole("button", { name: "Return" }).click();
    await expect(returnDialog.getByText("Write what the member should fix.")).toBeVisible();
    await returnDialog.getByLabel("What should the member fix?").fill(NOTE);
    await returnDialog.getByRole("button", { name: "Return" }).click();
    await expect(manager.getByText(/^Returned /).first()).toBeVisible();
    await expect(recordRow(manager, "Lê Minh Châu", AWS)).toHaveCount(0);

    // The member sees the note, fixes the date and sends it again.
    await member.goto("/me");
    await expect(recordRow(member, AWS)).toContainText("Returned");
    await openMenu(member, "Edit");
    await expect(member.getByRole("dialog").getByRole("alert")).toContainText(NOTE);
    await member.getByRole("dialog").getByLabel(fieldLabel("Date passed")).fill("02/06/2026");
    await member.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(member.getByText("Saved certificate. It is waiting for approval.")).toBeVisible();

    // Nothing counted yet; the manager approves in one click.
    await manager.goto("/records?approval=waiting");
    await expect(recordRow(manager, "Lê Minh Châu", AWS)).toBeVisible();
    await openMenu(manager, "Approve");
    await expect(manager.getByText(/^Approved /)).toBeVisible();

    await manager.goto("/dashboard");
    await expect(waitingTile(manager).getByText("0", { exact: true })).toBeVisible();
    await member.goto("/dashboard");
    await expect(heldValue(member)).toHaveText("1");
  } finally {
    await memberContext.close();
    await managerContext.close();
  }
});

test("E-12: a member has no Approve or Return, and a direct call is refused", async ({ page }) => {
  // A waiting certificate to look at, added the way the member would (a member's certificate starts waiting).
  const admin = await signInAsSeedAdmin();
  const prepared = await (await signInAsSeedUser("member@certtracker.test"))
    .from("training_records")
    .insert({ member_id: CHAU, certificate_id: AWS_ID, status: "done", progress: 100, issued_date: "2026-06-01" });
  if (prepared.error) throw new Error(`prepare waiting item: ${prepared.error.message}`);

  await signIn(page, "member@certtracker.test");
  await page.goto("/me");
  await recordRow(page, AWS).getByRole("button", { name: /Actions for/ }).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /^Approve/ })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Return" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Waiting for approval \(/ })).toHaveCount(0);

  // The same call the page would make, as the member: the database refuses.
  const member = await signInAsSeedUser("member@certtracker.test");
  const approve = await member
    .from("training_records")
    .update({ approval: "approved" })
    .eq("member_id", CHAU)
    .eq("certificate_id", AWS_ID)
    .select("id");
  expect(approve.error?.code).toBe("42501");
  const after = await admin.from("training_records").select("approval").eq("member_id", CHAU).eq("certificate_id", AWS_ID).single();
  expect(after.data?.approval).toBe("waiting");
});
