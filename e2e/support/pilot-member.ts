import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page } from "@playwright/test";
import { fieldLabel } from "../helpers";
import { adminApi, deleteAccount } from "./accounts";
import { signInAsSeedAdmin } from "./restore-seed";

/**
 * The invited members the pilot specs create. Every login and member has a `pilot-<timestamp>-…@example.com`
 * address, so a crashed run's leftovers are found and removed by that pattern.
 */
const PILOT_EMAIL_PATTERN = /^pilot-\d+-[a-z0-9]+@example\.com$/;
const PILOT_EMAIL_LIKE = "pilot-%@example.com";
export const PILOT_PASSWORD = "A-pilot-password-1";
export const AWS = "AWS Solutions Architect Associate";
export const TEAM_CLOUD_ID = "5eed0000-0000-0000-0000-00000000a001";
export const TEAM_AI_ID = "5eed0000-0000-0000-0000-00000000a002";

export const pilotEmail = (suffix: string) => `pilot-${Date.now()}-${suffix}@example.com`;

/** Removes every pilot login, member, certificate and proof file, including those of an earlier crashed run. */
export async function removePilotPeople() {
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

/** Adds a member as the seeded admin (RLS) and returns its id. */
export async function addPilotMember(fullName: string, email: string, teamId = TEAM_CLOUD_ID): Promise<string> {
  const admin = await signInAsSeedAdmin();
  const { data, error } = await admin.from("members").insert({ full_name: fullName, email, team_id: teamId }).select("id").single();
  if (error) throw new Error(`add member: ${error.message}`);
  return data.id;
}

export async function signInWithPilotPassword(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PILOT_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

/** Opens the invitation link, chooses a password and signs in with it. */
export async function acceptInvitation(page: Page, email: string, hash: string) {
  await page.goto(`/set-password?token_hash=${hash}&type=invite`);
  await page.getByLabel("New password").fill(PILOT_PASSWORD);
  await page.getByLabel("Confirm password").fill(PILOT_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/\/login\?passwordSet=1$/);
  await signInWithPilotPassword(page, email);
}

/** Opens a member's own "Add certificate" form at `/me` with a course picked (AWS unless named). */
export async function openOwnCertificateForm(page: Page, query = "aws", courseName = AWS): Promise<Locator> {
  await page.goto("/records");
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("button", { name: "Add certificate" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(fieldLabel("Course")).fill(query);
  // The popup is portalled outside the dialog.
  await page.getByRole("option", { name: courseName }).click();
  return dialog;
}

/** Evidence is only offered for a Completed certificate (R11), which needs an issue date. */
export async function chooseCompleted(page: Page, dialog: Locator, issueDate = "01/06/2026") {
  await dialog.getByLabel(fieldLabel("Status")).click();
  // The listbox is portalled outside the dialog.
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  await dialog.getByLabel(fieldLabel("Issue date")).fill(issueDate);
}

/** A member adds the AWS certificate, Completed, on their own page with a PDF proof. */
export async function addOwnCertificateWithProof(page: Page) {
  const dialog = await openOwnCertificateForm(page);
  await chooseCompleted(page, dialog);
  await dialog.getByLabel("Evidence").setInputFiles("e2e/fixtures/evidence.pdf");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Added certificate")).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

/** Clicks an export link on /records and returns the downloaded file's bytes. */
export async function downloadExport(page: Page, linkName: "Export CSV" | "Export Excel"): Promise<Buffer> {
  await page.goto("/records");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: linkName }).click()]);
  return readFile(await file.path());
}

export function recordRow(page: Page, ...texts: string[]): Locator {
  let row = page.getByRole("row");
  for (const text of texts) row = row.filter({ hasText: text });
  return row;
}

/** The "View evidence" link of a row; the upload revalidates after the record appears, so retry until it exists. */
export async function evidenceHref(page: Page, row: Locator): Promise<string> {
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
