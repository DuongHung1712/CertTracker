import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";
import { adminApi, deleteAccount, inviteLink } from "./support/accounts";
import { giveSeedManagerAMember } from "./support/manager-scopes";
import { signInAsSeedAdmin } from "./support/restore-seed";

// The DAS pilot's first day (spec §7.4 E-1, E-2, E-10). Every login and member this spec creates has a
// `pilot-<timestamp>-…@example.com` address, so a crashed run's leftovers are found and removed by that pattern.
const PILOT_EMAIL_PATTERN = /^pilot-\d+-[a-z0-9]+@example\.com$/;
const PILOT_EMAIL_LIKE = "pilot-%@example.com";
const PASSWORD = "A-pilot-password-1";
const AWS = "AWS Solutions Architect Associate";
const VIETNAMESE_NAME = "Nguyễn Thị Hằng";
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const pilotEmail = (suffix: string) => `pilot-${Date.now()}-${suffix}@example.com`;

/** Removes every pilot login, member, certificate and proof file, including those of an earlier crashed run. */
async function removePilotPeople() {
  const api = adminApi();
  const { data: users, error: listError } = await api.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`list users: ${listError.message}`);
  for (const user of users.users.filter((candidate) => PILOT_EMAIL_PATTERN.test(candidate.email ?? ""))) {
    await deleteAccount(user.id);
  }
  const admin = await signInAsSeedAdmin();
  const { data: members, error: memberError } = await admin.from("members").select("id").like("email", PILOT_EMAIL_LIKE);
  if (memberError) throw new Error(`read pilot members: ${memberError.message}`);
  const memberIds = members.map((member) => member.id);
  if (memberIds.length === 0) return;
  const { data: records, error: recordError } = await admin
    .from("training_records")
    .delete()
    .in("member_id", memberIds)
    .select("evidence_path");
  if (recordError) throw new Error(`delete pilot records: ${recordError.message}`);
  const proofs = records.map((record) => record.evidence_path).filter((path): path is string => path !== null);
  if (proofs.length > 0) {
    const { error } = await api.storage.from("certificates").remove(proofs);
    if (error) throw new Error(`remove pilot proofs: ${error.message}`);
  }
  const { data: deleted, error } = await admin.from("members").delete().in("id", memberIds).select("id");
  if (error) throw new Error(`delete pilot members: ${error.message}`);
  // RLS turns a forbidden delete into a silent no-op, so prove the result.
  if (deleted.length !== memberIds.length) throw new Error("removePilotPeople left pilot members behind.");
}

async function addMemberWithAdmin(fullName: string, email: string) {
  const admin = await signInAsSeedAdmin();
  const { error } = await admin.from("members").insert({ full_name: fullName, email, team_id: "5eed0000-0000-0000-0000-00000000a001" });
  if (error) throw new Error(`add member: ${error.message}`);
}

/** Opens the invitation link, chooses a password and signs in with it. */
async function acceptInvitation(page: Page, email: string, hash: string) {
  await page.goto(`/set-password?token_hash=${hash}&type=invite`);
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/login\?passwordSet=1$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

/** A member adds the AWS certificate on their own page with a PDF proof. */
async function addOwnCertificateWithProof(page: Page) {
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Course", { exact: true }).fill("aws");
  // The popup is portalled outside the dialog.
  await page.getByRole("option", { name: AWS }).click();
  await dialog.getByLabel("Evidence").setInputFiles("e2e/fixtures/evidence.pdf");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Added certificate")).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

function recordRow(page: Page, ...texts: string[]): Locator {
  let row = page.getByRole("row");
  for (const text of texts) row = row.filter({ hasText: text });
  return row;
}

/** The "View evidence" link of a row; the upload revalidates after the record appears, so retry until it exists. */
async function evidenceHref(page: Page, row: Locator): Promise<string> {
  const link = page.getByRole("menuitem", { name: "View evidence" });
  await expect(async () => {
    await page.keyboard.press("Escape");
    await row.getByRole("button", { name: /Actions for/ }).click();
    await expect(link).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  const href = await link.getAttribute("href");
  await page.keyboard.press("Escape");
  return href!;
}

function recordsTile(page: Page): Locator {
  return page
    .getByRole("region", { name: "Overview", exact: true })
    .locator("dl > div")
    .filter({ has: page.getByText("Certificate records", { exact: true }) })
    .locator("dd")
    .first();
}

async function readRecordsCount(page: Page): Promise<number> {
  await page.goto("/dashboard");
  await expect(recordsTile(page)).toHaveText(/^\d+$/);
  return Number(await recordsTile(page).textContent());
}

async function exportCsv(page: Page): Promise<string> {
  await page.goto("/records");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
  return (await readFile(await file.path())).toString("utf8");
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe.configure({ mode: "serial" });
test.beforeAll(removePilotPeople);
test.afterAll(removePilotPeople);

test("E-1: a member's whole first day reaches the manager, the dashboard and the export", async ({ browser }) => {
  test.setTimeout(120_000); // three sign-ins, an upload and its revalidation, a download
  const email = pilotEmail("e1");
  const adminPage = await (await browser.newContext()).newPage();
  const memberPage = await (await browser.newContext()).newPage();
  const managerPage = await (await browser.newContext()).newPage();
  const removeManagerMember = await giveSeedManagerAMember();
  try {
    await signIn(adminPage, "admin@certtracker.test");
    const recordsBefore = await readRecordsCount(adminPage);

    await adminPage.goto("/members");
    await adminPage.getByRole("button", { name: "Add member" }).click();
    const dialog = adminPage.getByRole("dialog");
    await dialog.getByLabel("Full name").fill(VIETNAMESE_NAME);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Team").click();
    await adminPage.getByRole("option", { name: "Team Cloud", exact: true }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(adminPage.getByRole("cell", { name: email })).toBeVisible();

    const { hash } = await inviteLink(email);
    await acceptInvitation(memberPage, email, hash);
    await addOwnCertificateWithProof(memberPage);
    await memberPage.getByRole("button", { name: "Account" }).click();
    await memberPage.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(memberPage).toHaveURL(/\/login$/);

    await signIn(managerPage, "manager@certtracker.test");
    await managerPage.goto("/records");
    const row = recordRow(managerPage, VIETNAMESE_NAME, AWS);
    await expect(row).toBeVisible();
    const href = await evidenceHref(managerPage, row);
    expect(href).toMatch(/^\/api\/records\/[0-9a-f-]+\/evidence$/);
    expect((await managerPage.request.get(href, { maxRedirects: 0 })).status()).toBe(307);

    expect(await readRecordsCount(adminPage)).toBe(recordsBefore + 1);
    expect(await exportCsv(adminPage)).toContain(VIETNAMESE_NAME);
  } finally {
    await removeManagerMember();
    await Promise.all([adminPage, memberPage, managerPage].map((page) => page.context().close()));
  }
});

test("E-2: a login invited before its member exists is linked once the admin adds the member", async ({ page }) => {
  const email = pilotEmail("e2");
  const { hash } = await inviteLink(email);
  await acceptInvitation(page, email, hash);
  await page.goto("/me");
  await expect(page.getByText("Your account is not linked to a member")).toBeVisible();

  await addMemberWithAdmin("Pilot Linked Later", email);
  await page.reload();
  await expect(page.getByRole("heading", { name: "My certificates" })).toBeVisible();
  await expect(page.getByText("Your account is not linked to a member")).toHaveCount(0);
});

test("E-10: a member's first day works on a phone without horizontal scrolling", async ({ browser }) => {
  test.setTimeout(60_000);
  const email = pilotEmail("e10");
  await addMemberWithAdmin("Pilot Phone Member", email);
  const { hash } = await inviteLink(email);
  const context = await browser.newContext({ hasTouch: true });
  try {
    const page = await context.newPage();
    await page.setViewportSize(MOBILE_VIEWPORT);
    await acceptInvitation(page, email, hash);
    await expectNoHorizontalScroll(page);
    await addOwnCertificateWithProof(page);
    await expect(recordRow(page, AWS)).toBeVisible();
    await evidenceHref(page, recordRow(page, AWS));
    await expectNoHorizontalScroll(page);
  } finally {
    await context.close();
  }
});
