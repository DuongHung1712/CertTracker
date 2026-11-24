import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";
import { inviteLink } from "./support/accounts";
import { giveSeedManagerAMember } from "./support/manager-scopes";
import {
  acceptInvitation,
  addOwnCertificateWithProof,
  addPilotMember,
  AWS,
  downloadExport,
  evidenceHref,
  pilotEmail,
  recordRow,
  removePilotPeople,
} from "./support/pilot-member";

// The DAS pilot's first day (spec §7.4 E-1, E-2, E-10).
const VIETNAMESE_NAME = "Nguyễn Thị Hằng";
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// The pilot member adds a Completed exam certificate, so "of N completed" on the Valid certificates tile moves by one.
// With nothing completed yet the tile says so instead, which reads as 0.
async function readCompletedExams(page: Page): Promise<number> {
  await page.goto("/dashboard");
  const overview = page.getByRole("region", { name: "Overview", exact: true });
  await expect(overview).toContainText(/of \d+ completed|No completed certificates yet/);
  return Number(/of (\d+) completed/.exec((await overview.textContent()) ?? "")?.[1] ?? 0);
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
    const completedBefore = await readCompletedExams(adminPage);

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

    // A member's Completed certificate waits for approval (WBS 15.4) and counts only once the manager approves it.
    expect(await readCompletedExams(adminPage)).toBe(completedBefore);
    await row.getByRole("button", { name: /Actions for/ }).click();
    await managerPage.getByRole("menuitem", { name: "Approve" }).click();
    await expect(row).not.toContainText("Waiting for approval");

    expect(await readCompletedExams(adminPage)).toBe(completedBefore + 1);
    expect((await downloadExport(adminPage, "Export CSV")).toString("utf8")).toContain(VIETNAMESE_NAME);
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

  await addPilotMember("Pilot Linked Later", email);
  await page.reload();
  await expect(page.getByRole("heading", { name: "My learning" })).toBeVisible();
  await expect(page.getByText("Your account is not linked to a member")).toHaveCount(0);
});

test("E-10: a member's first day works on a phone without horizontal scrolling", async ({ browser }) => {
  test.setTimeout(60_000);
  const email = pilotEmail("e10");
  await addPilotMember("Pilot Phone Member", email);
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
