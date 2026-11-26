import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { adminApi, inviteLink } from "../support/accounts";
import { acceptInvitation, addPilotMember, removePilotPeople, TEAM_CLOUD_ID } from "../support/pilot-member";
import { signInAsSeedAdmin } from "../support/restore-seed";

export const AN_ID = "5eed0000-0000-0000-0000-00000000b001";
export const BINH_ID = "5eed0000-0000-0000-0000-00000000b002";
export const CHAU_ID = "5eed0000-0000-0000-0000-00000000b003";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "qa-artifacts/screenshots");

export function screenshotPath(name: string): string {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return path.join(SCREENSHOT_DIR, `${name}.png`);
}

export async function saveScreenshot(page: Page, name: string): Promise<string> {
  const filePath = screenshotPath(name);
  await page.screenshot({ path: filePath, fullPage: true });
  return `qa-artifacts/screenshots/${name}.png`;
}

export interface ErrorTrap {
  consoleErrors: string[];
  pageErrors: string[];
  clear: () => void;
  assertNoErrors: (context?: string) => void;
}

export function attachErrorTrap(page: Page): ErrorTrap {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  return {
    consoleErrors,
    pageErrors,
    clear: () => {
      consoleErrors.length = 0;
      pageErrors.length = 0;
    },
    assertNoErrors: (context = "page") => {
      expect(pageErrors, `Uncaught page errors on ${context}`).toEqual([]);
      expect(consoleErrors, `Console errors on ${context}`).toEqual([]);
    },
  };
}

/** Cleans all member_skills, manager_scopes, learning_items, training_records, storage files and pilot accounts. */
export async function cleanupQaPilotData(opts: { memberIds?: string[]; userIds?: string[] } = {}): Promise<void> {
  const api = adminApi();
  const memberIds = [...new Set((opts.memberIds ?? []).filter(Boolean))];
  const userIds = [...new Set((opts.userIds ?? []).filter(Boolean))];

  if (memberIds.length > 0) {
    await api.from("member_skills").delete().in("member_id", memberIds);
    await api.from("learning_items").delete().in("member_id", memberIds);
    const { data: recs } = await api
      .from("training_records")
      .delete()
      .in("member_id", memberIds)
      .select("evidence_path");
    const paths = (recs ?? []).map((r) => r.evidence_path).filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await api.storage.from("certificates").remove(paths);
    }
  }
  if (userIds.length > 0) {
    await api.from("manager_scopes").delete().in("user_id", userIds);
  }
  await removePilotPeople();
}

export async function createLinkedPilotMember(
  fullName: string,
  email: string,
  teamId = TEAM_CLOUD_ID,
): Promise<{ memberId: string; userId: string; hash: string }> {
  const memberId = await addPilotMember(fullName, email, teamId);
  const { userId, hash } = await inviteLink(email);
  return { memberId, userId, hash };
}

export async function createLinkedPilotManager(
  fullName: string,
  email: string,
  teamId = TEAM_CLOUD_ID,
): Promise<{ memberId: string; userId: string; hash: string }> {
  const { memberId, userId, hash } = await createLinkedPilotMember(fullName, email, teamId);
  const api = adminApi();
  const roleRes = await api.from("profiles").update({ role: "manager" }).eq("user_id", userId);
  if (roleRes.error) throw new Error(`promote pilot manager: ${roleRes.error.message}`);
  const scopeRes = await api.from("manager_scopes").insert({ user_id: userId, team_id: teamId });
  if (scopeRes.error) throw new Error(`grant pilot manager scope: ${scopeRes.error.message}`);
  return { memberId, userId, hash };
}

export async function signInInvitedPilot(page: Page, email: string, hash: string): Promise<void> {
  await acceptInvitation(page, email, hash);
}

export async function getMemberNamesForExclusion(): Promise<string[]> {
  const admin = await signInAsSeedAdmin();
  const { data } = await admin.from("members").select("full_name");
  return (data ?? []).map((m) => m.full_name).filter(Boolean);
}

const VIETNAMESE_DIACRITIC_RE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

export function findNonEnglishArtifacts(rawText: string, ignoredProperNames: string[]): {
  vietnameseTokens: string[];
  brokenTokens: string[];
} {
  let cleaned = rawText;
  for (const name of ignoredProperNames) {
    cleaned = cleaned.split(name).join(" ");
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  const vietnameseTokens = words.filter((w) => VIETNAMESE_DIACRITIC_RE.test(w));
  const brokenTokens: string[] = [];
  for (const pattern of [/\bNaN\b/i, /\bundefined\b/, /Invalid Date/i]) {
    const match = cleaned.match(pattern);
    if (match) brokenTokens.push(match[0]);
  }
  return { vietnameseTokens, brokenTokens };
}
