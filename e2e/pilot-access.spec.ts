import { expect, test, type Page } from "@playwright/test";
import { EVIDENCE_TOO_LARGE_MESSAGE, MAX_EVIDENCE_BYTES } from "../src/lib/storage/evidence";
import { signIn } from "./helpers";
import { inviteLink } from "./support/accounts";
import {
  acceptInvitation,
  addOwnCertificateWithProof,
  addPilotMember,
  AWS,
  evidenceHref,
  openOwnCertificateForm,
  pilotEmail,
  recordRow,
  removePilotPeople,
  signInWithPilotPassword,
  TEAM_AI_ID,
} from "./support/pilot-member";
import { signInAsSeedAdmin } from "./support/restore-seed";

// Access and boundary journeys of the DAS pilot (spec §7.4 E-3 to E-7). Members A and B are invited logins on
// Team AI; the seeded manager (manager@certtracker.test) manages only Team Cloud, so A is out of their scope.
const APP_ROUTES = ["/dashboard", "/me", "/members", "/records", "/courses", "/org", "/import", "/data-quality", "/settings"];
const CRON_ROUTES = ["/api/cron/expiry-alerts", "/api/cron/monthly-report"];
const REFUSED_WITHOUT_DATA = [307, 401, 404];
const MAX_REDIRECTS = 5;
const WRONG_TYPE_MESSAGE = "Only PDF, JPG, PNG or WebP files are accepted.";
const NVIDIA = "NVIDIA Generative AI LLMs";

const memberA = { email: pilotEmail("a"), id: "" };
const memberB = { email: pilotEmail("b"), id: "" };
let evidenceUrl = "";

const pathOf = (location: string | undefined) => new URL(location ?? "", "http://localhost").pathname;

async function recordCount(memberId: string): Promise<number> {
  const admin = await signInAsSeedAdmin();
  const { count, error } = await admin.from("training_records").select("id", { count: "exact", head: true }).eq("member_id", memberId);
  if (error) throw new Error(`count records: ${error.message}`);
  return count!;
}

async function closeSheet(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

// Not serial: a red journey must not hide the others. After a failure the new worker runs beforeAll again.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(90_000);
  await removePilotPeople();
  memberA.id = await addPilotMember("Pilot Member A", memberA.email, TEAM_AI_ID);
  memberB.id = await addPilotMember("Pilot Member B", memberB.email, TEAM_AI_ID);
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await acceptInvitation(page, memberA.email, (await inviteLink(memberA.email)).hash);
    await addOwnCertificateWithProof(page);
    evidenceUrl = await evidenceHref(page, recordRow(page, AWS));
    await context.clearCookies();
    await acceptInvitation(page, memberB.email, (await inviteLink(memberB.email)).hash);
  } finally {
    await context.close();
  }
});
test.afterAll(removePilotPeople);

test("E-3: a member cannot open another member's proof", async ({ page }) => {
  await signInWithPilotPassword(page, memberB.email);
  const response = await page.request.get(evidenceUrl, { maxRedirects: 0 });
  expect(response.status()).toBe(404);
  expect(response.headers()["location"]).toBeUndefined();
});

test("E-4: a manager cannot open the proof of a member outside their scope", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  const response = await page.request.get(evidenceUrl, { maxRedirects: 0 });
  expect(response.status()).toBe(404);
  expect(response.headers()["location"]).toBeUndefined();
});

test("E-5: a signed-out visitor is sent to /login and never gets data", async ({ request }) => {
  for (const route of APP_ROUTES) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), route).toBe(307);
    expect(pathOf(response.headers()["location"]), route).toBe("/login");
  }

  const dataResponses = {
    "/api/export/records": await request.get("/api/export/records", { maxRedirects: 0 }),
    "/api/import/parse": await request.post("/api/import/parse", { maxRedirects: 0, multipart: { file: { name: "a.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("x") } } }),
    [evidenceUrl]: await request.get(evidenceUrl, { maxRedirects: 0 }),
  };
  for (const [route, response] of Object.entries(dataResponses)) {
    expect(REFUSED_WITHOUT_DATA, route).toContain(response.status());
  }

  for (const route of CRON_ROUTES) {
    expect((await request.get(route, { maxRedirects: 0 })).status(), route).toBe(401);
  }
});

test("E-6: signing out in one browser sends the other to /login without a loop, and it can sign in again", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await signInWithPilotPassword(pageA, memberA.email);
    await signInWithPilotPassword(pageB, memberA.email);

    // The app's signOut() uses supabase-js's default scope, "global": every session of the user ends.
    await pageA.getByRole("button", { name: "Account" }).click();
    await pageA.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(pageA).toHaveURL(/\/login$/);

    let redirects = 0;
    pageB.on("response", (response) => {
      // A redirect carries a location; a 304 Not Modified for a cached chunk is 3xx too but is not a redirect.
      if (response.status() >= 300 && response.status() < 400 && response.headers()["location"]) redirects += 1;
    });
    await pageB.goto("/dashboard");
    await expect(pageB).toHaveURL(/\/login$/);
    await expect(pageB.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(redirects).toBeLessThanOrEqual(MAX_REDIRECTS);

    await signInWithPilotPassword(pageB, memberA.email);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("E-7: a proof over 4 MB shows the form's message and nothing is saved", async ({ page }) => {
  await signInWithPilotPassword(page, memberB.email);
  const before = await recordCount(memberB.id);
  const dialog = await openOwnCertificateForm(page);
  const oversized = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_EVIDENCE_BYTES + 1 - 5)]);
  await dialog.getByLabel("Evidence").setInputFiles({ name: "proof.pdf", mimeType: "application/pdf", buffer: oversized });
  await expect(dialog.getByText(EVIDENCE_TOO_LARGE_MESSAGE)).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  if ((await page.getByRole("dialog").count()) > 0) await closeSheet(page);
  expect(await recordCount(memberB.id)).toBe(before);
});

test("E-7: a text file renamed .pdf shows the form's message and nothing is saved", async ({ page }) => {
  await signInWithPilotPassword(page, memberB.email);
  const before = await recordCount(memberB.id);
  const dialog = await openOwnCertificateForm(page, "nvidia", NVIDIA);
  await dialog.getByLabel("Evidence").setInputFiles({ name: "proof.pdf", mimeType: "application/pdf", buffer: Buffer.from("just some text\n") });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(WRONG_TYPE_MESSAGE)).toBeVisible();
  if ((await page.getByRole("dialog").count()) > 0) await closeSheet(page);
  expect(await recordCount(memberB.id)).toBe(before);
});
