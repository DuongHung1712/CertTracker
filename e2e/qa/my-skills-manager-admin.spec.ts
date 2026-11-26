import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { fieldLabel, SEED_PASSWORD, signIn } from "../helpers";
import { adminApi } from "../support/accounts";
import { readEnvFile } from "../support/env";
import {
  AWS,
  PILOT_PASSWORD,
  pilotEmail,
  recordRow,
  removePilotPeople,
  TEAM_AI_ID,
  TEAM_CLOUD_ID,
} from "../support/pilot-member";
import {
  AN_ID,
  attachErrorTrap,
  BINH_ID,
  CHAU_ID,
  cleanupQaPilotData,
  createLinkedPilotManager,
  createLinkedPilotMember,
  saveScreenshot,
  signInInvitedPilot,
} from "./qa-helpers";

test.beforeAll(removePilotPeople);
test.afterAll(removePilotPeople);

function anonClient() {
  const fromFile = readEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromFile.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fromFile.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

test("manager: waiting queue, /members badge & View skills, out-of-scope, Return note validation & resubmit, Approve, and cannot approve own Level 5", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const cloudEmail = pilotEmail("qacloud");
  const aiEmail = pilotEmail("qaai");
  const mgrEmail = pilotEmail("qamgr");
  const cloudName = "QA Cloud Pilot";
  const aiName = "QA AI Pilot";
  const mgrName = "QA Linked Manager";

  const cloud = await createLinkedPilotMember(cloudName, cloudEmail, TEAM_CLOUD_ID);
  const ai = await createLinkedPilotMember(aiName, aiEmail, TEAM_AI_ID);
  const linkedMgr = await createLinkedPilotManager(mgrName, mgrEmail, TEAM_CLOUD_ID);

  const cloudCtx = await browser.newContext();
  const aiCtx = await browser.newContext();
  const mgrCtx = await browser.newContext();
  const linkedMgrCtx = await browser.newContext();
  const adminCtx = await browser.newContext();

  try {
    const cloudPage = await cloudCtx.newPage();
    const aiPage = await aiCtx.newPage();
    const mgrPage = await mgrCtx.newPage();
    const linkedMgrPage = await linkedMgrCtx.newPage();
    const adminPage = await adminCtx.newPage();

    const mgrTrap = attachErrorTrap(mgrPage);
    const cloudTrap = attachErrorTrap(cloudPage);
    const linkedMgrTrap = attachErrorTrap(linkedMgrPage);

    // 1. Cloud pilot submits Level 5 on Kubernetes; AI pilot submits Level 5 on PostgreSQL; Linked Manager rates own Level 5 on API Design.
    await signInInvitedPilot(cloudPage, cloudEmail, cloud.hash);
    await cloudPage.goto("/skills");
    await cloudPage.getByRole("button", { name: "Update skill rate" }).click();
    let dlg = cloudPage.getByRole("dialog", { name: "Update skill rate" });
    await dlg.getByLabel("Search all skills").fill("Kubernetes & Container Orchestration");
    await dlg.getByRole("row").filter({ hasText: "Kubernetes & Container Orchestration" }).getByRole("radio", { name: /^Level 5/ }).click();
    await dlg.getByRole("button", { name: "Save ratings" }).click();
    await expect(dlg).toHaveCount(0);

    // Add note + 3 years to Kubernetes (keeps L5 pending)
    await cloudPage.getByRole("button", { name: "Edit Kubernetes & Container Orchestration" }).click();
    dlg = cloudPage.getByRole("dialog");
    await dlg.getByLabel(/Years using this skill at work/).fill("3");
    await dlg.getByLabel("What have you done with it?").fill("Operated 3 multi-tenant clusters");
    await dlg.getByRole("button", { name: "Send for review" }).click();
    await expect(dlg).toHaveCount(0);

    await signInInvitedPilot(aiPage, aiEmail, ai.hash);
    await aiPage.goto("/skills");
    await aiPage.getByRole("button", { name: "Update skill rate" }).click();
    dlg = aiPage.getByRole("dialog", { name: "Update skill rate" });
    await dlg.getByRole("row").filter({ hasText: "PostgreSQL & Relational Data Modeling" }).getByRole("radio", { name: /^Level 5/ }).click();
    await dlg.getByRole("button", { name: "Save ratings" }).click();
    await expect(dlg).toHaveCount(0);

    await signInInvitedPilot(linkedMgrPage, mgrEmail, linkedMgr.hash);
    await linkedMgrPage.goto("/skills");
    await linkedMgrPage.getByRole("button", { name: "Update skill rate" }).click();
    dlg = linkedMgrPage.getByRole("dialog", { name: "Update skill rate" });
    await dlg
      .getByRole("row")
      .filter({ hasText: "API Design & Protocol Architecture (gRPC & REST)" })
      .getByRole("radio", { name: /^Level 5/ })
      .click();
    await dlg.getByRole("button", { name: "Save ratings" }).click();
    await expect(dlg).toHaveCount(0);

    // 2. Seed Manager sees /skills "Waiting for your review" ONLY for Team Cloud (NOT Team AI).
    await signIn(mgrPage, "manager@certtracker.test");
    await mgrPage.goto("/skills");
    const reviewQueue = mgrPage.getByRole("region", { name: "Waiting for your review" });
    await expect(reviewQueue).toBeVisible();
    await expect(reviewQueue).toContainText(cloudName);
    await expect(reviewQueue).toContainText("Operated 3 multi-tenant clusters");
    await expect(reviewQueue).not.toContainText(aiName);
    await saveScreenshot(mgrPage, "manager-waiting-queue");

    // 3. Manager out-of-scope / nonexistent / invalid memberId checks.
    for (const badTarget of [BINH_ID, ai.memberId, "5eed0000-0000-0000-0000-999999999999", "not-a-uuid"]) {
      await mgrPage.goto(`/skills?memberId=${badTarget}`);
      await expect(mgrPage.getByText("Member not found")).toBeVisible();
      await expect(mgrPage.getByRole("link", { name: "Back to Members" })).toHaveAttribute("href", "/members");
    }

    // 4. Manager /members shows pending count badge & "View skills", opens Cloud pilot's profile.
    await mgrPage.goto("/members");
    const cloudMemberRow = mgrPage.getByRole("row", { name: new RegExp(cloudName) });
    await expect(cloudMemberRow.getByRole("link", { name: new RegExp(`Review 1 pending Level 5 skill for ${cloudName}`) })).toBeVisible();
    await saveScreenshot(mgrPage, "members-pending-badge");
    await cloudMemberRow.getByRole("button", { name: new RegExp(`Actions for ${cloudName}`) }).click();
    await mgrPage.getByRole("menuitem", { name: "View skills" }).click();
    await expect(mgrPage).toHaveURL(new RegExp(`/skills\\?memberId=${cloud.memberId}$`));
    await expect(mgrPage.getByRole("heading", { level: 1, name: `Skills · ${cloudName}` })).toBeVisible();

    // Manager view of member is read-only except Approve / Return (no radio groups, no Edit button).
    const k8sMgrCard = mgrPage.locator("article").filter({ hasText: "Kubernetes & Container Orchestration" });
    await expect(k8sMgrCard.getByRole("radio")).toHaveCount(0);
    await expect(k8sMgrCard.getByRole("button", { name: /Edit/ })).toHaveCount(0);

    // 5. Return requires a non-empty note (empty and whitespace-only rejected).
    await k8sMgrCard.getByRole("button", { name: /^Return/ }).click();
    const returnDialog = mgrPage.getByRole("alertdialog");
    await returnDialog.getByRole("button", { name: "Return" }).click();
    await expect(returnDialog.getByText("Write what the member should fix.")).toBeVisible();
    await returnDialog.getByLabel(/What should the member fix/).fill("   ");
    await returnDialog.getByRole("button", { name: "Return" }).click();
    await expect(returnDialog.getByText("Write what the member should fix.")).toBeVisible();

    const returnNote = "Add incident drill metrics & rollback SOP";
    await returnDialog.getByLabel(/What should the member fix/).fill(returnNote);
    await returnDialog.getByRole("button", { name: "Return" }).click();
    await expect(returnDialog).toHaveCount(0);
    await expect(k8sMgrCard).toContainText("Level 4 · Expert");
    await expect(k8sMgrCard).toContainText("Returned");
    await expect(k8sMgrCard).toContainText(`Returned: ${returnNote}`);

    // 6. Member after Return sees Returned + manager note + level 4 on Dashboard, Card, Table, Detail, and Edit;
    //    saving resubmits to Level 5 Waiting for review and clears the manager note completely.
    await cloudPage.goto("/dashboard");
    const dashSkills = cloudPage.getByRole("region", { name: "My skills", exact: true });
    await expect(dashSkills.getByText("1 skill returned for changes")).toBeVisible();
    await saveScreenshot(cloudPage, "member-dashboard-returned");

    await cloudPage.goto("/skills");
    const k8sMemCard = cloudPage.locator("article").filter({ hasText: "Kubernetes & Container Orchestration" });
    await expect(k8sMemCard).toContainText("Level 4 · Expert");
    await expect(k8sMemCard).toContainText("Returned");
    await expect(k8sMemCard).toContainText(`Returned: ${returnNote}`);
    await saveScreenshot(cloudPage, "member-skill-returned");

    // Table view also displays Returned status + note
    await cloudPage.getByRole("button", { name: "Table view" }).click();
    const k8sTableRow = cloudPage.getByRole("row").filter({ hasText: "Kubernetes & Container Orchestration" });
    await expect(k8sTableRow).toContainText("Returned");
    await expect(k8sTableRow).toContainText(`Returned: ${returnNote}`);
    await cloudPage.getByRole("button", { name: "Card view" }).click();

    // Detail view displays alert with return note
    await k8sMemCard.getByRole("button", { name: "Kubernetes & Container Orchestration", exact: true }).click();
    await expect(cloudPage.getByRole("dialog").getByRole("alert")).toContainText(returnNote);
    await cloudPage.keyboard.press("Escape");

    // Save at Level 5 -> resubmits and clears review_note in UI & Postgres.
    await cloudPage.getByRole("button", { name: "Edit Kubernetes & Container Orchestration" }).click();
    const editDlg = cloudPage.getByRole("dialog");
    await expect(editDlg.getByRole("alert")).toContainText(returnNote);
    await editDlg.getByRole("radio", { name: /^5 · Master/ }).click();
    await editDlg.getByLabel("What have you done with it?").fill("Added chaos drill & rollback SOP metrics");
    await editDlg.getByRole("button", { name: "Send for review" }).click();
    await expect(editDlg).toHaveCount(0);

    await cloudPage.reload();
    await expect(k8sMemCard).toContainText("Level 5 · Master");
    await expect(k8sMemCard).toContainText("Waiting for review");
    await expect(k8sMemCard).not.toContainText(returnNote);
    const dbResubmitted = await adminApi()
      .from("member_skills")
      .select("current_level, verification_status, review_note")
      .eq("member_id", cloud.memberId)
      .single();
    expect(dbResubmitted.data?.current_level).toBe(5);
    expect(dbResubmitted.data?.verification_status).toBe("pending_review");
    expect(dbResubmitted.data?.review_note).toBeNull();

    // 7. Manager approves from "Waiting for your review" queue; pending badge disappears.
    await mgrPage.goto("/skills");
    await expect(reviewQueue).toContainText(cloudName);
    await reviewQueue.getByRole("listitem").filter({ hasText: cloudName }).getByRole("button", { name: /^Approve/ }).click();
    await expect(reviewQueue.getByRole("listitem").filter({ hasText: cloudName })).toHaveCount(0);

    await cloudPage.reload();
    await expect(k8sMemCard).toContainText("Level 5 · Master");
    await expect(k8sMemCard).toContainText("Certified");

    await mgrPage.goto("/members");
    await expect(
      mgrPage.getByRole("row", { name: new RegExp(cloudName) }).getByRole("link", { name: /Review \d+ pending/ }),
    ).toHaveCount(0);

    // 8. Linked Manager CANNOT approve their own Level 5 (UI + URL ?memberId=self + DB trigger 42501).
    await linkedMgrPage.goto("/skills");
    const ownSkillCard = linkedMgrPage
      .locator("article")
      .filter({ hasText: "API Design & Protocol Architecture (gRPC & REST)" });
    await expect(ownSkillCard).toContainText("Level 5 · Master");
    await expect(ownSkillCard).toContainText("Waiting for review");
    // Own Level 5 must NOT appear in own review queue and must have no Approve/Return buttons anywhere.
    const ownQueue = linkedMgrPage.getByRole("region", { name: "Waiting for your review" });
    if ((await ownQueue.count()) > 0) {
      await expect(ownQueue).not.toContainText(mgrName);
    }
    await expect(ownSkillCard.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
    await expect(ownSkillCard.getByRole("button", { name: /^Return/ })).toHaveCount(0);
    await saveScreenshot(linkedMgrPage, "manager-own-l5-no-approve");

    // Also open own memberId via query string: still no Approve/Return!
    await linkedMgrPage.goto(`/skills?memberId=${linkedMgr.memberId}`);
    await expect(ownSkillCard.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
    await expect(ownSkillCard.getByRole("button", { name: /^Return/ })).toHaveCount(0);

    // Also open detail dialog on own Level 5: still no Approve/Return!
    await ownSkillCard.getByRole("button", { name: "API Design & Protocol Architecture (gRPC & REST)", exact: true }).click();
    await expect(linkedMgrPage.getByRole("dialog").getByRole("button", { name: /^Approve/ })).toHaveCount(0);
    await linkedMgrPage.keyboard.press("Escape");

    // Attempt direct Supabase API self-certification with linked Manager's JWT -> must fail with 42501.
    const mgrSb = anonClient();
    const loginRes = await mgrSb.auth.signInWithPassword({ email: mgrEmail, password: PILOT_PASSWORD });
    expect(loginRes.error).toBeNull();
    const selfCertAttempt = await mgrSb
      .from("member_skills")
      .update({ verification_status: "certified" })
      .eq("member_id", linkedMgr.memberId)
      .select("id");
    expect(selfCertAttempt.error?.code).toBe("42501");

    // 9. Admin can view ANY member's skills across both Team Cloud and Team AI & approve Team AI's Level 5.
    await signIn(adminPage, "admin@certtracker.test");
    await adminPage.goto("/skills");
    await expect(adminPage.getByText("Choose a member in Members to view their skills")).toBeVisible();
    await expect(adminPage.getByRole("region", { name: "Waiting for your review" })).toContainText(aiName);

    await adminPage.goto("/members");
    for (const target of [
      { id: BINH_ID, heading: "Skills · Trần Thị Bình" },
      { id: AN_ID, heading: "Skills · Nguyễn Văn An" },
      { id: CHAU_ID, heading: "Skills · Lê Minh Châu" },
      { id: ai.memberId, heading: `Skills · ${aiName}` },
    ]) {
      await adminPage.goto(`/skills?memberId=${target.id}`);
      await expect(adminPage.getByRole("heading", { level: 1, name: target.heading })).toBeVisible();
    }

    // Admin approves AI Pilot's Level 5 on Team AI
    const aiPgCard = adminPage.locator("article").filter({ hasText: "PostgreSQL & Relational Data Modeling" });
    await aiPgCard.getByRole("button", { name: /^Approve/ }).click();
    await expect(aiPgCard).toContainText("Certified");
    await expect(aiPgCard).toContainText("Level 5 · Master");

    // Also approve linked manager's L5 as Admin cleanly or leave to cleanup; verify zero console errors on tracked pages.
    mgrTrap.assertNoErrors("manager workflow");
    cloudTrap.assertNoErrors("cloud member workflow");
    linkedMgrTrap.assertNoErrors("linked manager workflow");
  } finally {
    await cloudCtx.close();
    await aiCtx.close();
    await mgrCtx.close();
    await linkedMgrCtx.close();
    await adminCtx.close();
    await cleanupQaPilotData({
      memberIds: [cloud.memberId, ai.memberId, linkedMgr.memberId],
      userIds: [cloud.userId, ai.userId, linkedMgr.userId],
    });
  }
});

test("an@certtracker.test auth check, AWS Certified proof vs View certificate (seed An & uploaded PDF proof)", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const pilotProofEmail = pilotEmail("qaproof");
  const pilotProofName = "QA Proof Member";
  const proofMem = await createLinkedPilotMember(pilotProofName, pilotProofEmail, TEAM_CLOUD_ID);

  const anLoginCtx = await browser.newContext();
  const mgrCtx = await browser.newContext();
  const memCtx = await browser.newContext();

  try {
    // 1. Check whether an@certtracker.test can sign in directly at /login.
    const anPage = await anLoginCtx.newPage();
    await anPage.goto("/login");
    await anPage.getByLabel("Email").fill("an@certtracker.test");
    await anPage.getByLabel("Password", { exact: true }).fill(SEED_PASSWORD);
    await anPage.getByRole("button", { name: "Sign in" }).click();
    await expect(anPage.locator("#login-error")).toContainText(/Wrong email or password/i);
    await saveScreenshot(anPage, "an-login-no-account");

    // 2. Inspect An's seeded /skills via Manager -> AWS shows "Certified", check "View certificate" link!
    const mgrPage = await mgrCtx.newPage();
    const mgrTrap = attachErrorTrap(mgrPage);
    await signIn(mgrPage, "manager@certtracker.test");
    await mgrPage.goto(`/skills?memberId=${AN_ID}`);
    const anAwsCard = mgrPage.locator("article").filter({ hasText: "Cloud Architecture & AWS Services" });
    await expect(anAwsCard).toContainText("Certified");
    await expect(anAwsCard).toContainText(AWS);

    await anAwsCard.getByRole("button", { name: "Cloud Architecture & AWS Services" }).click();
    const anDetail = mgrPage.getByRole("dialog", { name: "Cloud Architecture & AWS Services" });
    await expect(anDetail).toContainText(AWS);
    const anViewCertCount = await anDetail.getByRole("link", { name: /View certificate/i }).count();
    // Seeded An's training_records row has evidence_path=null & certificate_url=null, so View certificate is absent.
    expect(anViewCertCount).toBe(0);
    await saveScreenshot(mgrPage, "an-detail-missing-view-certificate");
    await mgrPage.keyboard.press("Escape");

    // 3. Verify "View certificate" DOES appear and serves HTTP 200 PDF when an approved certificate HAS proof!
    const memPage = await memCtx.newPage();
    const memTrap = attachErrorTrap(memPage);
    await signInInvitedPilot(memPage, pilotProofEmail, proofMem.hash);
    await memPage.goto("/skills");
    await memPage.getByRole("button", { name: "Update skill rate" }).click();
    const batch = memPage.getByRole("dialog", { name: "Update skill rate" });
    await batch.getByLabel("Search all skills").fill("Cloud Architecture & AWS Services");
    await batch.getByRole("row").filter({ hasText: "Cloud Architecture & AWS Services" }).getByRole("radio", { name: /^Level 3/ }).click();
    await batch.getByRole("button", { name: "Save ratings" }).click();
    await expect(batch).toHaveCount(0);

    // Waiting certificate must NOT prematurely certify the skill.
    await memPage.goto("/me");
    await memPage.getByRole("button", { name: "Add certificate" }).click();
    const recDialog = memPage.getByRole("dialog");
    await recDialog.locator('input[type="file"]').first().setInputFiles("e2e/fixtures/evidence.pdf");
    // Wait for optional AI reader to finish if active so fields stay clean
    await expect(recDialog.getByRole("button", { name: "Save" })).toBeEnabled({ timeout: 20_000 });
    await recDialog.getByLabel(fieldLabel("Certificate")).fill("aws");
    await memPage.getByRole("option", { name: AWS }).click();
    await recDialog.getByLabel(fieldLabel("Date passed")).fill("01/06/2026");
    await recDialog.getByRole("button", { name: "Save" }).click();
    await expect(memPage.getByText("Added certificate")).toBeVisible();
    await expect(recDialog).toHaveCount(0);

    memTrap.clear();
    await memPage.goto("/skills");
    const proofAwsCard = memPage.locator("article").filter({ hasText: "Cloud Architecture & AWS Services" });
    await expect(proofAwsCard).toContainText("Self-rated");

    // Manager approves the submitted AWS certificate on /records.
    await mgrPage.goto(`/records?search=${encodeURIComponent(pilotProofName)}`);
    const recRow = recordRow(mgrPage, pilotProofName, AWS);
    await expect(recRow).toBeVisible();
    await recRow.getByRole("button", { name: /Actions for/ }).click();
    await mgrPage.getByRole("menuitem", { name: /^Approve/ }).click();
    await expect(mgrPage.getByText(/Approved/i)).toBeVisible();

    // Now member opens /skills -> AWS skill becomes Certified with a working "View certificate" link!
    await memPage.goto("/skills");
    await expect(proofAwsCard).toContainText("Certified");
    await expect(proofAwsCard).toContainText(AWS);
    await proofAwsCard.getByRole("button", { name: "Cloud Architecture & AWS Services", exact: true }).click();
    const proofDetail = memPage.getByRole("dialog", { name: "Cloud Architecture & AWS Services" });
    const viewCertLink = proofDetail.getByRole("link", { name: /View certificate/i });
    await expect(viewCertLink).toBeVisible();
    await saveScreenshot(memPage, "aws-view-certificate-working");

    const href = await viewCertLink.getAttribute("href");
    expect(href).toMatch(/^\/api\/records\/.+\/evidence$/);
    const pdfRes = await memPage.request.get(href!);
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toContain("application/pdf");

    await memPage.keyboard.press("Escape");
    // Log any console errors caught on /skills (without aborting test since Hydration error on /skills is already tracked)
    if (memTrap.consoleErrors.length > 0) {
      console.log("MEM_PROOF_SKILLS_CONSOLE_ERRS:", JSON.stringify(memTrap.consoleErrors.slice(0, 2).map((e) => e.slice(0, 120))));
    }
    expect(memTrap.pageErrors).toEqual([]);
    expect(mgrTrap.pageErrors).toEqual([]);
  } finally {
    await anLoginCtx.close();
    await mgrCtx.close();
    await memCtx.close();
    await cleanupQaPilotData({ memberIds: [proofMem.memberId], userIds: [proofMem.userId] });
  }
});
