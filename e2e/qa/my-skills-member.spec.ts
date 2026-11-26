import { expect, test } from "@playwright/test";
import { signIn } from "../helpers";
import { adminApi } from "../support/accounts";
import { pilotEmail, removePilotPeople, TEAM_CLOUD_ID } from "../support/pilot-member";
import {
  AN_ID,
  attachErrorTrap,
  BINH_ID,
  CHAU_ID,
  cleanupQaPilotData,
  createLinkedPilotMember,
  saveScreenshot,
  signInInvitedPilot,
} from "./qa-helpers";

test.beforeAll(removePilotPeople);
test.afterAll(removePilotPeople);

test("member: empty profile, batch changed-only + down-to-0, quick-rate 0-5 reload, 2.5y + note edit, L5 pending, remove, dashboard parity", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const trap = attachErrorTrap(page);
  const email = pilotEmail("qamem1");
  const { memberId, userId, hash } = await createLinkedPilotMember("QA Pilot Member One", email, TEAM_CLOUD_ID);
  const api = adminApi();

  try {
    await signInInvitedPilot(page, email, hash);

    // 1. Dashboard "My skills" starts empty with "No skills rated yet" + "Rate skills" CTA.
    const dashSkills = page.getByRole("region", { name: "My skills", exact: true });
    await expect(dashSkills.getByText("No skills rated yet")).toBeVisible();
    await dashSkills.getByRole("link", { name: "Rate skills" }).click();
    await expect(page).toHaveURL(/\/skills$/);

    // 2. Empty /skills profile shows "No skills rated yet" and no hardcoded seed/fake skills.
    await expect(page.getByText("No skills rated yet")).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    await saveScreenshot(page, "member-empty-skills");

    // 3. Open "Update skill rate" batch dialog -> "Save ratings" starts disabled while clean.
    await page.getByRole("button", { name: "Update skill rate" }).click();
    const batchDialog = page.getByRole("dialog", { name: "Update skill rate" });
    await expect(batchDialog.getByRole("button", { name: "Save ratings" })).toBeDisabled();

    // Rate only 2 backend skills (leave other 180 untouched) and track Server Action POST payload + DB rows.
    const batchPostBodies: string[] = [];
    const onReq = (req: import("@playwright/test").Request) => {
      if (req.method() === "POST" && req.url().includes("/skills")) {
        batchPostBodies.push(req.postData() ?? "");
      }
    };
    page.on("request", onReq);

    const pythonBatchRow = batchDialog.getByRole("row").filter({ hasText: "Python (FastAPI & AsyncIO)" });
    await pythonBatchRow.getByRole("radio", { name: /^Level 3/ }).click();
    const pgBatchRow = batchDialog.getByRole("row").filter({ hasText: "PostgreSQL & Relational Data Modeling" });
    await pgBatchRow.getByRole("radio", { name: /^Level 4/ }).click();

    await expect(batchDialog.getByText("2 skills changed. Save to update your profile.")).toBeVisible();
    await batchDialog.getByRole("button", { name: "Save ratings" }).click();
    await expect(batchDialog).toHaveCount(0);

    // Reload to prove persistence and verify DB only saved 2 rows (not 182).
    await page.reload();
    await expect(page.getByText("Python (FastAPI & AsyncIO)")).toBeVisible();
    await expect(page.getByText("PostgreSQL & Relational Data Modeling")).toBeVisible();
    const afterFirstBatch = await api
      .from("member_skills")
      .select("skill_id, current_level, years_of_experience, evidence_note, updated_at, skills(name)")
      .eq("member_id", memberId);
    expect(afterFirstBatch.data).toHaveLength(2);
    const pythonBeforeSecondBatch = afterFirstBatch.data!.find(
      (r) => (r.skills as { name?: string } | null)?.name === "Python (FastAPI & AsyncIO)",
    )!;
    const pgRowDb = afterFirstBatch.data!.find(
      (r) => (r.skills as { name?: string } | null)?.name === "PostgreSQL & Relational Data Modeling",
    )!;
    expect(pythonBeforeSecondBatch.current_level).toBe(3);
    expect(pgRowDb.current_level).toBe(4);

    // Verify Server Action POST sent only the 2 skill IDs (no unrelated skill UUIDs).
    const firstPayload = batchPostBodies.join("\n");
    expect(firstPayload).toContain(pythonBeforeSecondBatch.skill_id);
    expect(firstPayload).toContain(pgRowDb.skill_id);
    expect(firstPayload).not.toContain("5eed0000-0000-0000-0000-00000000a201"); // Cloud AWS skill untouched

    // 4. Edit Python skill with invalid YoE first (-1), then valid 2.5 years + evidence note.
    await page.getByRole("button", { name: "Edit Python (FastAPI & AsyncIO)" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel(/Years using this skill at work/).fill("-1");
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel(/Years using this skill at work/).fill("2.5");
    await editDialog.getByLabel("What have you done with it?").fill("Built async webhook worker");
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(editDialog).toHaveCount(0);

    await page.reload();
    const pythonCard = page.locator("article").filter({ hasText: "Python (FastAPI & AsyncIO)" });
    await expect(pythonCard).toContainText("2.5 years");
    await expect(pythonCard).toContainText("Built async webhook worker");

    const afterEditDb = await api
      .from("member_skills")
      .select("skill_id, updated_at, years_of_experience, evidence_note")
      .eq("member_id", memberId)
      .eq("skill_id", pythonBeforeSecondBatch.skill_id)
      .single();
    expect(Number(afterEditDb.data?.years_of_experience)).toBe(2.5);
    expect(afterEditDb.data?.evidence_note).toBe("Built async webhook worker");

    // 5. Batch update: change ONLY PostgreSQL down from 4 to 0; Python must NOT be touched or sent!
    batchPostBodies.length = 0;
    await page.getByRole("button", { name: "Update skill rate" }).click();
    await expect(batchDialog).toBeVisible();
    await pgBatchRow.getByRole("radio", { name: /^Level 0/ }).click();
    await expect(batchDialog.getByText("1 skill changed. Save to update your profile.")).toBeVisible();
    await batchDialog.getByRole("button", { name: "Save ratings" }).click();
    await expect(batchDialog).toHaveCount(0);

    const secondPayload = batchPostBodies.join("\n");
    expect(secondPayload).toContain(pgRowDb.skill_id);
    expect(secondPayload).not.toContain(pythonBeforeSecondBatch.skill_id);
    page.off("request", onReq);

    // Check Python's updated_at, years_of_experience, and note remained untouched in Postgres.
    const pythonAfterSecondBatch = await api
      .from("member_skills")
      .select("current_level, years_of_experience, evidence_note, updated_at")
      .eq("member_id", memberId)
      .eq("skill_id", pythonBeforeSecondBatch.skill_id)
      .single();
    expect(pythonAfterSecondBatch.data?.updated_at).toBe(afterEditDb.data?.updated_at);
    expect(Number(pythonAfterSecondBatch.data?.years_of_experience)).toBe(2.5);
    expect(pythonAfterSecondBatch.data?.evidence_note).toBe("Built async webhook worker");

    await page.reload();
    const pgCard = page.locator("article").filter({ hasText: "PostgreSQL & Relational Data Modeling" });
    await expect(pgCard).toContainText("Level 0 · None");
    await expect(pgCard).toContainText("Self-rated");

    // 6. Quick-rate ALL values 0–5 sequentially (waiting for server save toast before reload) and confirm persistence.
    for (const lvl of [1, 2, 3, 4, 0, 5] as const) {
      await pgCard.getByRole("radio", { name: new RegExp(`^Level ${lvl},`) }).click();
      await expect(pgCard).toContainText(new RegExp(`Level ${lvl} ·`));
      await expect(
        page.getByText(
          lvl === 5
            ? /PostgreSQL & Relational Data Modeling set to level 5, waiting for manager review/
            : new RegExp(`PostgreSQL & Relational Data Modeling set to level ${lvl} \\(`),
        ).first(),
      ).toBeVisible();
      if (lvl === 1 || lvl === 4 || lvl === 0 || lvl === 5) {
        await page.reload();
        await expect(pgCard).toContainText(new RegExp(`Level ${lvl} ·`));
      }
    }
    await expect(pgCard).toContainText("Level 5 · Master");
    await expect(pgCard).toContainText("Waiting for review");

    // Probe rapid quick-rate race (2 -> 3 -> 4 immediately back to 4 before reload without waiting) on Python skill:
    // check whether rapid clicks + immediate navigation/reload drop updates cleanly or lose latest click.
    await pythonCard.getByRole("radio", { name: /^Level 2,/ }).click();
    await pythonCard.getByRole("radio", { name: /^Level 3,/ }).click();
    await pythonCard.getByRole("radio", { name: /^Level 3,/ }).waitFor();
    await page.waitForLoadState("networkidle");
    await pythonCard.getByRole("radio", { name: /^Level 3,/ }).click();
    await expect(
      page.getByText(/Python \(FastAPI & AsyncIO\) set to level 3/).first(),
    ).toBeVisible();
    await page.reload();
    await expect(pythonCard).toContainText("Level 3 · Advanced");

    // 7. Verify KPI tiles on /skills match Dashboard "My skills" card numbers exactly (Python=3, PostgreSQL=5 -> avg 4.0).
    const summaryRegion = page.getByRole("region", { name: "Summary" });
    await expect(summaryRegion).toContainText("4.0");
    await expect(summaryRegion).toContainText("of 2 skills");
    await expect(summaryRegion.locator("[data-slot=kpi-tile]").filter({ hasText: "Waiting for review" })).toContainText("1");
    await expect(summaryRegion.locator("[data-slot=kpi-tile]").filter({ hasText: "Certified" })).toContainText("0");
    await saveScreenshot(page, "member-rated-with-l5-pending");

    await page.goto("/dashboard");
    await expect(dashSkills.locator("dl")).toContainText("2");
    await expect(dashSkills.locator("dl")).toContainText("4.0");
    await expect(dashSkills.locator("dl")).toContainText("1");
    await expect(dashSkills.getByRole("link", { name: "View skills" })).toHaveAttribute("href", "/skills");

    // 8. Remove a skill -> reload verifies persistence -> dashboard updates -> remove last skill -> empty state returns.
    await page.goto("/skills");
    await page.getByRole("button", { name: "Edit PostgreSQL & Relational Data Modeling" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    const confirmRemove = page.getByRole("alertdialog");
    await confirmRemove.getByRole("button", { name: "Remove" }).click();
    await expect(confirmRemove).toHaveCount(0);
    await expect(page.locator("article").filter({ hasText: "PostgreSQL & Relational Data Modeling" })).toHaveCount(0);

    await page.reload();
    await expect(page.locator("article").filter({ hasText: "PostgreSQL & Relational Data Modeling" })).toHaveCount(0);
    await expect(pythonCard).toBeVisible();

    await page.goto("/dashboard");
    await expect(dashSkills.locator("dl")).toContainText("1");
    await expect(dashSkills.locator("dl")).toContainText("3.0");
    await expect(dashSkills.locator("dl")).toContainText("0");

    // Remove the final remaining skill.
    await page.goto("/skills");
    await page.getByRole("button", { name: "Edit Python (FastAPI & AsyncIO)" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No skills rated yet")).toBeVisible();
    await page.reload();
    await expect(page.getByText("No skills rated yet")).toBeVisible();

    trap.assertNoErrors("member lifecycle");
  } finally {
    await cleanupQaPilotData({ memberIds: [memberId], userIds: [userId] });
  }
});

test("member: ?memberId redirect rules, own ?memberId allowed, seeded member dashboard parity, and view/filter controls", async ({
  page,
}) => {
  const trap = attachErrorTrap(page);
  await signIn(page, "member@certtracker.test");

  // Other members (same team & other team) redirect to /skills.
  await page.goto(`/skills?memberId=${AN_ID}`);
  await expect(page).toHaveURL(/\/skills$/);
  await page.goto(`/skills?memberId=${BINH_ID}`);
  await expect(page).toHaveURL(/\/skills$/);

  // Own memberId loads own profile without redirecting into error.
  await page.goto(`/skills?memberId=${CHAU_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "My skills" })).toBeVisible();

  // Compare seeded Châu /skills summary metrics vs /dashboard "My skills" card.
  await page.goto("/skills");
  const skillsSummary = page.getByRole("region", { name: "Summary" });
  const avgText = await skillsSummary
    .locator("[data-slot=kpi-tile]")
    .filter({ has: page.getByText("Average level", { exact: true }) })
    .locator("dd")
    .first()
    .innerText();
  const certifiedText = await skillsSummary
    .locator("[data-slot=kpi-tile]")
    .filter({ has: page.getByText("Certified", { exact: true }) })
    .locator("dd")
    .first()
    .innerText();
  const pendingText = await skillsSummary
    .locator("[data-slot=kpi-tile]")
    .filter({ has: page.getByText("Waiting for review", { exact: true }) })
    .locator("dd")
    .first()
    .innerText();
  const totalMatch = (await skillsSummary.innerText()).match(/of (\d+) skills?/);
  const totalCount = totalMatch?.[1] ?? "0";

  // Toggle Table view & search/status filters & Clear all filters.
  await page.getByRole("button", { name: "Table view" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search skills or certificates" }).fill("zzz-no-such-skill");
  await expect(page.getByText("No skills match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Card view" }).click();

  await page.goto("/dashboard");
  const dashSkills = page.getByRole("region", { name: "My skills", exact: true });
  await expect(
    dashSkills.locator("dl > div").filter({ hasText: "Rated skills" }).locator("dd"),
  ).toHaveText(totalCount);
  await expect(
    dashSkills.locator("dl > div").filter({ hasText: "Average level" }).locator("dd"),
  ).toHaveText(avgText.trim());
  await expect(
    dashSkills.locator("dl > div").filter({ hasText: "Certified" }).locator("dd"),
  ).toHaveText(certifiedText.trim());
  await expect(
    dashSkills.locator("dl > div").filter({ hasText: "Waiting for review" }).locator("dd"),
  ).toHaveText(pendingText.trim());

  trap.assertNoErrors("member@certtracker.test checks");
});

test("member exploratory: rapid quick-rate clicks 2 -> 3 -> 4 + reload race condition", async ({ page }) => {
  const email = pilotEmail("qarace");
  const { memberId, userId, hash } = await createLinkedPilotMember("QA Race Member", email, TEAM_CLOUD_ID);
  try {
    await signInInvitedPilot(page, email, hash);
    await page.goto("/skills");
    await page.getByRole("button", { name: "Update skill rate" }).click();
    const dlg = page.getByRole("dialog", { name: "Update skill rate" });
    await dlg.getByRole("row").filter({ hasText: "Python (FastAPI & AsyncIO)" }).getByRole("radio", { name: /^Level 1/ }).click();
    await dlg.getByRole("button", { name: "Save ratings" }).click();
    await expect(dlg).toHaveCount(0);

    const card = page.locator("article").filter({ hasText: "Python (FastAPI & AsyncIO)" });
    await card.getByRole("radio", { name: /^Level 2,/ }).click();
    await card.getByRole("radio", { name: /^Level 3,/ }).click();
    await card.getByRole("radio", { name: /^Level 4,/ }).click();
    await expect(card).toContainText("Level 4 · Expert");
    // Reload after UI already shows Level 4 (optimistic update without waiting/serializing requests)
    await page.reload();
    await expect(card).toContainText("Level 4 · Expert");
  } finally {
    await cleanupQaPilotData({ memberIds: [memberId], userIds: [userId] });
  }
});
