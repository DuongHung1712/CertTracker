import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { adminApi, inviteLink } from "./support/accounts";
import {
  acceptInvitation,
  addPilotMember,
  pilotEmail,
  removePilotPeople,
  TEAM_CLOUD_ID,
} from "./support/pilot-member";

const AN_ID = "5eed0000-0000-0000-0000-00000000b001";
const RETURN_NOTE = "Add architecture RFC and rollout metrics";

test.describe.configure({ mode: "serial" });
test.beforeAll(removePilotPeople);
test.afterAll(removePilotPeople);

test("empty member rates, edits 0.5y, persists across reload, and completes Level 5 return/approve loop", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const email = pilotEmail("skills");
  const pilotName = "Pilot Skills Member";
  const pilotMemberId = await addPilotMember(pilotName, email, TEAM_CLOUD_ID);
  const { hash } = await inviteLink(email);

  const memberContext = await browser.newContext();
  const managerContext = await browser.newContext();
  try {
    const member = await memberContext.newPage();
    const manager = await managerContext.newPage();

    await acceptInvitation(member, email, hash);

    // Dashboard SkillsMatrixCard starts empty with "Rate skills" CTA.
    const skillsSection = member.getByRole("region", { name: "My skills", exact: true });
    await expect(skillsSection.getByText("No skills rated yet")).toBeVisible();
    await skillsSection.getByRole("link", { name: "Rate skills" }).click();
    await expect(member).toHaveURL(/\/skills$/);

    // Fresh member sees zero fake skills and clicks "Update skill rate".
    await expect(member.getByText("No skills rated yet")).toBeVisible();
    await expect(member.getByText("Distributed Systems & Resilient Messaging")).toHaveCount(0);
    await member.getByRole("button", { name: "Update skill rate" }).click();

    const batchDialog = member.getByRole("dialog", { name: "Update skill rate" });
    const pythonRow = batchDialog.getByRole("row").filter({ hasText: "Python (FastAPI & AsyncIO)" });
    await pythonRow.getByRole("radio", { name: /^Level 3/ }).click();
    const pgRow = batchDialog.getByRole("row").filter({ hasText: "PostgreSQL & Relational Data Modeling" });
    await pgRow.getByRole("radio", { name: /^Level 4/ }).click();
    await batchDialog.getByRole("button", { name: "Save ratings" }).click();
    await expect(batchDialog).toHaveCount(0);

    await member.reload();
    await expect(member.getByText("Python (FastAPI & AsyncIO)")).toBeVisible();
    await expect(member.getByText("PostgreSQL & Relational Data Modeling")).toBeVisible();

    // Edit 0.5 years + evidence note and verify persistence across reload.
    await member.getByRole("button", { name: "Edit Python (FastAPI & AsyncIO)" }).click();
    const editDialog = member.getByRole("dialog");
    await editDialog.getByLabel(/Years using this skill at work/).fill("2.5");
    await editDialog.getByLabel("What have you done with it?").fill("Built async webhook worker");
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(editDialog).toHaveCount(0);

    await member.reload();
    const pythonCard = member.locator("article").filter({ hasText: "Python (FastAPI & AsyncIO)" });
    await expect(pythonCard).toContainText("2.5 years");
    await expect(pythonCard).toContainText("Built async webhook worker");

    // Request Level 5 on PostgreSQL skill.
    await member.getByRole("button", { name: "Edit PostgreSQL & Relational Data Modeling" }).click();
    const l5Dialog = member.getByRole("dialog");
    await l5Dialog.getByRole("radio", { name: /^5 · Master/ }).click();
    await l5Dialog.getByRole("button", { name: "Send for review" }).click();
    await expect(l5Dialog).toHaveCount(0);

    const pgCard = member.locator("article").filter({ hasText: "PostgreSQL & Relational Data Modeling" });
    await expect(pgCard).toContainText("Waiting for review");

    // Manager opens /members, sees pending badge, navigates to /skills?memberId=..., and returns with a note.
    await signIn(manager, "manager@certtracker.test");
    await manager.goto("/members");
    const memberRow = manager.getByRole("row", { name: new RegExp(pilotName) });
    await expect(memberRow.getByRole("link", { name: /Review 1 pending Level 5 skill/ })).toBeVisible();
    await memberRow.getByRole("button", { name: /Actions for/ }).click();
    await manager.getByRole("menuitem", { name: "View skills" }).click();
    await expect(manager).toHaveURL(new RegExp(`/skills\\?memberId=${pilotMemberId}$`));

    const mgrPgCard = manager.locator("article").filter({ hasText: "PostgreSQL & Relational Data Modeling" });
    await mgrPgCard.getByRole("button", { name: /Return/ }).click();
    const returnDialog = manager.getByRole("alertdialog");
    await returnDialog.getByRole("button", { name: "Return" }).click();
    await expect(returnDialog.getByText("Write what the member should fix.")).toBeVisible();
    await returnDialog.getByLabel(/What should the member fix/).fill(RETURN_NOTE);
    await returnDialog.getByRole("button", { name: "Return" }).click();
    await expect(returnDialog).toHaveCount(0);
    await expect(mgrPgCard).toContainText("Returned");
    await expect(mgrPgCard).toContainText(`Returned: ${RETURN_NOTE}`);

    // Member sees returned note, fixes to Level 5 again, and manager approves from pending queue.
    await member.reload();
    await expect(pgCard).toContainText("Returned");
    await expect(pgCard).toContainText(`Returned: ${RETURN_NOTE}`);
    await member.getByRole("button", { name: "Edit PostgreSQL & Relational Data Modeling" }).click();
    const fixDialog = member.getByRole("dialog");
    await expect(fixDialog.getByRole("alert")).toContainText(RETURN_NOTE);
    await fixDialog.getByRole("radio", { name: /^5 · Master/ }).click();
    await fixDialog.getByRole("button", { name: "Send for review" }).click();
    await expect(fixDialog).toHaveCount(0);

    await manager.goto("/skills");
    const reviewQueue = manager.getByRole("region", { name: "Waiting for your review" });
    await expect(reviewQueue).toContainText(pilotName);
    await reviewQueue
      .getByRole("listitem")
      .filter({ hasText: pilotName })
      .getByRole("button", { name: /Approve/ })
      .click();
    await expect(reviewQueue.getByRole("listitem").filter({ hasText: pilotName })).toHaveCount(0);

    // Member reloads /skills and /dashboard: Level 5 is Certified and dashboard card updates.
    await member.reload();
    await expect(pgCard).toContainText("Level 5 · Master");
    await expect(pgCard).toContainText("Certified");

    await member.goto("/dashboard");
    await expect(skillsSection).toContainText("2");
    await expect(skillsSection.getByRole("link", { name: "View skills" })).toHaveAttribute("href", "/skills");
  } finally {
    await memberContext.close();
    await managerContext.close();
    await adminApi().from("member_skills").delete().eq("member_id", pilotMemberId);
    await removePilotPeople();
  }
});

test("displays live certificate proof for approved certificates and blocks members from viewing others", async ({
  browser,
}) => {
  const managerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
    const manager = await managerContext.newPage();
    const member = await memberContext.newPage();

    await signIn(manager, "manager@certtracker.test");
    await manager.goto(`/skills?memberId=${AN_ID}`);
    await expect(manager.getByRole("heading", { level: 1, name: "Skills · Nguyễn Văn An" })).toBeVisible();

    const awsCard = manager.locator("article").filter({ hasText: "Cloud Architecture & AWS Services" });
    await expect(awsCard).toContainText("Certified");
    await expect(awsCard).toContainText("AWS Solutions Architect Associate");

    await awsCard.getByRole("button", { name: "Cloud Architecture & AWS Services" }).click();
    const detailDialog = manager.getByRole("dialog");
    await expect(detailDialog).toContainText("AWS Solutions Architect Associate");
    await expect(detailDialog).toContainText("AWS");
    await expect(detailDialog.getByText(/Check credential/i)).toHaveCount(0);
    await detailDialog.getByRole("button", { name: "Close" }).first().click();

    await signIn(member, "member@certtracker.test");
    await member.goto(`/skills?memberId=${AN_ID}`);
    await expect(member).toHaveURL(/\/skills$/);
  } finally {
    await managerContext.close();
    await memberContext.close();
  }
});
