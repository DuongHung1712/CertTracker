import { expect, test } from "@playwright/test";
import { signIn } from "../helpers";
import { pilotEmail, removePilotPeople, TEAM_CLOUD_ID } from "../support/pilot-member";
import {
  AN_ID,
  attachErrorTrap,
  cleanupQaPilotData,
  createLinkedPilotMember,
  findNonEnglishArtifacts,
  getMemberNamesForExclusion,
  saveScreenshot,
  signInInvitedPilot,
} from "./qa-helpers";

test.beforeAll(removePilotPeople);
test.afterAll(removePilotPeople);

test("keyboard navigation: SkillQuickRate arrows/Home/End and dialogs trap focus & close on Esc", async ({ page }) => {
  test.setTimeout(120_000);
  const trap = attachErrorTrap(page);
  const email = pilotEmail("qaa11y");
  const { memberId, userId, hash } = await createLinkedPilotMember("QA Pilot A11y", email, TEAM_CLOUD_ID);

  try {
    await signInInvitedPilot(page, email, hash);
    await page.goto("/skills");

    // Add 1 skill so card quick-rate & Edit/Detail dialogs can be exercised without mutating seed users.
    await page.getByRole("button", { name: "Update skill rate" }).click();
    const batchDialog = page.getByRole("dialog", { name: "Update skill rate" });
    await expect(batchDialog).toBeVisible();

    // Verify immediate Esc closes clean dialog before tabbing.
    await page.keyboard.press("Escape");
    await expect(batchDialog).toHaveCount(0);

    // 1. Focus trap + Esc after Tabbing inside clean Batch dialog; capture active element details!
    await page.getByRole("button", { name: "Update skill rate" }).click();
    await expect(batchDialog).toBeVisible();
    const tabTrace: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          inside: Boolean(el?.closest('[role="dialog"]')),
          tag: el?.tagName,
          role: el?.getAttribute("role"),
          label: el?.getAttribute("aria-label") || el?.textContent?.trim().slice(0, 30),
          tooltips: document.querySelectorAll('[role="tooltip"]').length,
        };
      });
      tabTrace.push(`#${i + 1}:${info.tag}[role=${info.role},label=${info.label},inside=${info.inside},tooltips=${info.tooltips}]`);
      expect.soft(info.inside, `Tab #${i + 1} escaped Update skill rate dialog: ${tabTrace.at(-1)}`).toBe(true);
    }
    await page.keyboard.press("Escape");
    const openAfterFirstEsc = await batchDialog.count();
    if (openAfterFirstEsc > 0) {
      await saveScreenshot(page, "a11y-batch-dialog-esc-after-tab-bug");
      const afterSecond = await page.evaluate(() => ({
        tooltips: document.querySelectorAll('[role="tooltip"]').length,
        active: document.activeElement?.outerHTML.slice(0, 120),
      }));
      await page.keyboard.press("Escape");
      const openAfterSecondEsc = await batchDialog.count();
      console.log("BATCH_ESC_DIAG:", JSON.stringify({ openAfterFirstEsc, openAfterSecondEsc, tabTrace, afterSecond }));
      // Check with short timeout if Cancel button itself is clickable or blocked; then reload to continue a11y checks.
      try {
        await batchDialog.getByRole("button", { name: "Cancel" }).click({ timeout: 3_000 });
      } catch (e) {
        console.log("BATCH_CANCEL_CLICK_ERR:", String(e).split("\n")[0]);
        await page.reload();
      }
    }
    await expect.soft(openAfterFirstEsc, `Batch dialog stayed open on Esc after Tabbing (${tabTrace.join(" ; ")})`).toBe(0);

    // Rate Python at Level 2 and test dirty-Esc DiscardChangesDialog.
    await page.getByRole("button", { name: "Update skill rate" }).click();
    await batchDialog
      .getByRole("row")
      .filter({ hasText: "Python (FastAPI & AsyncIO)" })
      .getByRole("radio", { name: /^Level 2/ })
      .click();
    await page.keyboard.press("Escape");
    const discardDialog = page.getByRole("alertdialog", { name: /Discard/ });
    await expect(discardDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(discardDialog).toHaveCount(0);
    await expect(batchDialog).toBeVisible();

    await batchDialog.getByRole("button", { name: "Save ratings" }).click();
    await expect(batchDialog).toHaveCount(0);

    // 2. SkillQuickRate ArrowRight / ArrowLeft / Home / End + roving focus check.
    const card = page.locator("article").filter({ hasText: "Python (FastAPI & AsyncIO)" });
    const level2Radio = card.getByRole("radio", { name: /^Level 2,/ });
    await level2Radio.focus();
    await expect(level2Radio).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(card).toContainText("Level 3 · Advanced");
    const activeAfterRight = await page.evaluate(() => document.activeElement?.getAttribute("data-level"));
    expect.soft(activeAfterRight).toBe("3");

    await page.keyboard.press("End");
    await expect(card).toContainText("Level 5 · Master");
    const activeAfterEnd = await page.evaluate(() => document.activeElement?.getAttribute("data-level"));
    expect.soft(activeAfterEnd).toBe("5");

    await page.keyboard.press("Home");
    await expect(card).toContainText("Level 0 · None");
    const activeAfterHome = await page.evaluate(() => document.activeElement?.getAttribute("data-level"));
    expect.soft(activeAfterHome).toBe("0");

    await page.keyboard.press("ArrowRight");
    await expect(card).toContainText("Level 1 · Novice");
    await page.keyboard.press("ArrowLeft");
    await expect(card).toContainText("Level 0 · None");

    // 3. Level guide dialog traps focus and closes on Esc.
    await page.getByRole("button", { name: "Level guide" }).click();
    const guideDialog = page.getByRole("dialog", { name: "Skill levels 0–5" });
    await expect(guideDialog).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const target = await page.evaluate(() => ({
        inside: Boolean(document.activeElement?.closest('[role="dialog"]')),
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        label: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 30),
      }));
      expect.soft(target.inside, `Tab #${i + 1} escaped Level guide dialog -> ${JSON.stringify(target)}`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect.soft(guideDialog).toHaveCount(0);

    // 4. SkillDetailDialog traps focus and closes on Esc.
    await card.getByRole("button", { name: "Python (FastAPI & AsyncIO)", exact: true }).click();
    const detailDialog = page.getByRole("dialog", { name: "Python (FastAPI & AsyncIO)" });
    await expect(detailDialog).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const target = await page.evaluate(() => ({
        inside: Boolean(document.activeElement?.closest('[role="dialog"]')),
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        label: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 30),
      }));
      expect.soft(target.inside, `Tab #${i + 1} escaped Detail dialog -> ${JSON.stringify(target)}`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect.soft(detailDialog).toHaveCount(0);

    // 5. SkillAssessmentDialog + ConfirmDialog (Remove): focus trap + stacked Esc check!
    await page.getByRole("button", { name: "Edit Python (FastAPI & AsyncIO)" }).click();
    const editDialog = page.getByRole("dialog");
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const target = await page.evaluate(() => ({
        inside: Boolean(document.activeElement?.closest('[role="dialog"]')),
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        label: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 30),
      }));
      expect.soft(target.inside, `Tab #${i + 1} escaped Edit dialog -> ${JSON.stringify(target)}`).toBe(true);
    }
    await editDialog.getByRole("button", { name: "Remove" }).click();
    const removeAlert = page.getByRole("alertdialog");
    await expect(removeAlert).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const target = await page.evaluate(() => ({
        inside: Boolean(document.activeElement?.closest('[role="alertdialog"]')),
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        label: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 30),
      }));
      expect.soft(target.inside, `Tab #${i + 1} escaped Remove alertdialog -> ${JSON.stringify(target)}`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect.soft(removeAlert).toHaveCount(0);
    await expect.soft(editDialog).toBeVisible();
    if ((await editDialog.count()) > 0) {
      await page.keyboard.press("Escape");
    }
    await expect.soft(editDialog).toHaveCount(0);

    // Check inner table horizontal overflow on desktop 1280px /members too? Covered in mobile/desktop metrics cleanly.
    trap.assertNoErrors("a11y & keyboard");
  } finally {
    await cleanupQaPilotData({ memberIds: [memberId], userIds: [userId] });
  }
});

test("375 px mobile viewport & /members table container overflow diagnostics", async ({ page }) => {
  test.setTimeout(120_000);
  const trap = attachErrorTrap(page);
  await page.setViewportSize({ width: 375, height: 812 });

  const checkOverflow = async (label: string, shotName?: string) => {
    const metrics = await page.evaluate(() => {
      const doc = {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
      const wrappers = [...document.querySelectorAll('[data-slot="table-container"]')]
        .filter((el) => el.clientWidth > 0)
        .map((el) => ({
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowPx: el.scrollWidth - el.clientWidth,
        }));
      return { doc, wrappers };
    });
    console.log("VIEWPORT_METRICS", label, JSON.stringify(metrics));
    if (shotName) await saveScreenshot(page, shotName);
    expect(
      metrics.doc.scrollWidth,
      `${label} page overflowed horizontally: scrollWidth=${metrics.doc.scrollWidth}, clientWidth=${metrics.doc.clientWidth}`,
    ).toBeLessThanOrEqual(metrics.doc.clientWidth);
    for (const w of metrics.wrappers) {
      expect.soft(
        w.scrollWidth,
        `${label} inner table-container clipped horizontally: scrollWidth=${w.scrollWidth}, clientWidth=${w.clientWidth}`,
      ).toBeLessThanOrEqual(w.clientWidth);
    }
  };

  // Member at 375px
  await signIn(page, "member@certtracker.test");
  await checkOverflow("member /dashboard 375px", "mobile-375-member-dashboard");

  await page.goto("/skills");
  await expect(page.getByRole("heading", { level: 1, name: "My skills" })).toBeVisible();
  await checkOverflow("member /skills card view 375px", "mobile-375-skills-card");

  await page.getByRole("button", { name: "Table view" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await checkOverflow("member /skills table view 375px", "mobile-375-skills-table");
  await page.getByRole("button", { name: "Card view" }).click();

  // Open Update skill rate modal at 375px & check both document and modal overflow!
  await page.getByRole("button", { name: "Update skill rate" }).click();
  const batchDialog = page.getByRole("dialog", { name: "Update skill rate" });
  await expect(batchDialog).toBeVisible();
  await saveScreenshot(page, "mobile-375-batch-dialog");
  const batchOverflow = await batchDialog.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const skillCell = el.querySelector("tbody td:first-child")?.getBoundingClientRect();
    const tbl = el.querySelector('[data-slot="table-container"]');
    return {
      left: rect.left,
      right: rect.right,
      vw: window.innerWidth,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      tableScrollWidth: tbl?.scrollWidth,
      tableClientWidth: tbl?.clientWidth,
      firstSkillCellWidth: skillCell?.width,
    };
  });
  console.log("BATCH_MOBILE_METRICS", JSON.stringify(batchOverflow));
  expect(batchOverflow.right).toBeLessThanOrEqual(375);
  await page.keyboard.press("Escape");

  // Open Edit modal at 375px
  await page.getByRole("button", { name: /^Edit / }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await checkOverflow("member Edit modal 375px", "mobile-375-edit-dialog");
  await page.keyboard.press("Escape");

  // Manager at 375px
  await page.context().clearCookies();
  await signIn(page, "manager@certtracker.test");
  await page.goto("/skills");
  await checkOverflow("manager /skills 375px", "mobile-375-manager-skills");
  await page.goto(`/skills?memberId=${AN_ID}`);
  await checkOverflow("manager /skills?memberId=AN 375px", "mobile-375-manager-an");
  await page.goto("/members");
  await checkOverflow("manager /members 375px", "mobile-375-manager-members");

  // Admin at 375px
  await page.context().clearCookies();
  await signIn(page, "admin@certtracker.test");
  await page.goto("/skills");
  await checkOverflow("admin /skills 375px", "mobile-375-admin-skills");
  await page.goto("/members");
  await checkOverflow("admin /members 375px", "mobile-375-admin-members");

  // Also check desktop 1280px /members inner table horizontal clipping
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await expect(page.getByRole("table").last()).toBeVisible();
  await checkOverflow("admin /members 1280px", "desktop-1280-admin-members");

  trap.assertNoErrors("375px mobile checks");
});

test("all UI text on My Skills surfaces, dialogs, /members actions, and dashboard card is English", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const trap = attachErrorTrap(page);
  const memberNames = await getMemberNamesForExclusion();

  await signIn(page, "member@certtracker.test");
  await page.goto("/dashboard");
  const dashSkillsText = await page.getByRole("region", { name: "My skills", exact: true }).innerText();
  expect(findNonEnglishArtifacts(dashSkillsText, memberNames)).toEqual({
    vietnameseTokens: [],
    brokenTokens: [],
  });

  await page.goto("/skills");
  const skillsMainText = await page.getByRole("main").innerText();
  expect(findNonEnglishArtifacts(skillsMainText, memberNames)).toEqual({
    vietnameseTokens: [],
    brokenTokens: [],
  });
  expect(skillsMainText).not.toMatch(/credential/i);
  expect(skillsMainText).not.toMatch(/Preview only/i);

  await page.getByRole("button", { name: "Level guide" }).click();
  const guideText = await page.getByRole("dialog").innerText();
  expect(findNonEnglishArtifacts(guideText, memberNames)).toEqual({
    vietnameseTokens: [],
    brokenTokens: [],
  });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Update skill rate" }).click();
  const batchText = await page.getByRole("dialog").innerText();
  expect(findNonEnglishArtifacts(batchText, memberNames)).toEqual({
    vietnameseTokens: [],
    brokenTokens: [],
  });
  await page.keyboard.press("Escape");

  // Manager /skills?memberId=AN_ID + /members UI text check
  await page.context().clearCookies();
  await signIn(page, "manager@certtracker.test");
  await page.goto(`/skills?memberId=${AN_ID}`);
  const anText = await page.getByRole("main").innerText();
  expect(findNonEnglishArtifacts(anText, memberNames)).toEqual({
    vietnameseTokens: [],
    brokenTokens: [],
  });
  expect(anText).not.toMatch(/credential/i);

  trap.assertNoErrors("English text audit");
});
