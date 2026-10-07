// Captures the AS-BUILT screenshots used by docs/process/04-design-and-mockups.md.
// These are screenshots of the running application, NOT mockups.
//
// How to run (from the repository root):
//   1. supabase start && supabase db reset        # local Supabase with the seed data
//   2. pnpm build && pnpm exec next start -p 3100 # production build: no Next dev badge
//   3. node docs/process/mockups/capture.mjs [outputDir]
//
// Environment:
//   BASE_URL       default http://localhost:3100
//   SEED_PASSWORD  default: read from e2e/helpers.ts (the local seed password, never a real credential)
//
// The script only reads: it signs in through the real login form and opens screens. The only form it
// opens is the "add record" sheet, which it closes with Escape without saving. It exits non-zero on any failure.

import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";
const OUT_DIR = resolve(process.argv[2] ?? resolve(ROOT, "docs/process/images"));

function seedPassword() {
  if (process.env.SEED_PASSWORD) return process.env.SEED_PASSWORD;
  const source = readFileSync(resolve(ROOT, "e2e/helpers.ts"), "utf8");
  const match = source.match(/SEED_PASSWORD\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("SEED_PASSWORD not found in e2e/helpers.ts; set the SEED_PASSWORD env var");
  return match[1];
}

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const USERS = {
  admin: "admin@certtracker.test",
  manager: "manager@certtracker.test",
  member: "member@certtracker.test",
};

/** Waits until the page stops changing: network idle, no busy region, main heading (or a given control) visible. */
async function settle(page, ready) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 20_000 });
  await (ready ?? page.getByRole("heading", { level: 1 }).first()).waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  // Let late layout (fonts, charts) finish; there is no event to wait for.
  await page.waitForTimeout(400);
}

async function shoot(page, name) {
  const file = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`wrote ${file} (${Math.round(statSync(file).size / 1024)} KB)`);
}

async function open(page, path, name, ready) {
  await page.goto(`${BASE_URL}${path}`);
  await settle(page, ready);
  await shoot(page, name);
}

async function signIn(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.getByRole("heading", { name: "Dashboard" }).waitFor({ state: "visible", timeout: 20_000 });
}

async function inRole(browser, role, viewport, fn) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "vi-VN" });
  const page = await context.newPage();
  try {
    await signIn(page, USERS[role], seedPassword());
    await fn(page);
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const loginButton = (page) => page.getByRole("button", { name: "Đăng nhập" });

    // Anonymous: the login page, desktop and phone.
    for (const [viewport, name] of [
      [DESKTOP, "asbuilt-anon-login"],
      [MOBILE, "asbuilt-anon-login-mobile"],
    ]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "vi-VN" });
      const page = await context.newPage();
      await open(page, "/login", name, loginButton(page));
      await context.close();
    }

    await inRole(browser, "admin", DESKTOP, async (page) => {
      await open(page, "/dashboard", "asbuilt-admin-dashboard");
      await open(page, "/members", "asbuilt-admin-members");
      await open(page, "/records", "asbuilt-admin-records");
      await open(page, "/courses", "asbuilt-admin-courses");
      await open(page, "/org", "asbuilt-admin-org");
      await open(page, "/import", "asbuilt-admin-import");
      await open(page, "/data-quality", "asbuilt-admin-data-quality");
      await open(page, "/settings", "asbuilt-admin-settings");
    });

    await inRole(browser, "manager", DESKTOP, async (page) => {
      await open(page, "/dashboard", "asbuilt-manager-dashboard");
      // The personal ranking sits below the first screen: scroll it into view for a second shot.
      const ranking = page.getByRole("heading", { name: "Xếp hạng cá nhân" });
      await ranking.scrollIntoViewIfNeeded();
      await ranking.waitFor({ state: "visible" });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
      await shoot(page, "asbuilt-manager-dashboard-ranking");
      await open(page, "/records", "asbuilt-manager-records");
    });

    await inRole(browser, "member", DESKTOP, async (page) => {
      await open(page, "/dashboard", "asbuilt-member-dashboard");
      await open(page, "/me", "asbuilt-member-me");
      // The record editor: opened and closed without saving.
      await page.getByRole("button", { name: "Thêm chứng chỉ" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: "Thêm chứng chỉ" }).waitFor({ state: "visible" });
      await dialog.getByText("Minh chứng").waitFor({ state: "visible" });
      await page.waitForTimeout(600); // sheet slide-in animation
      await shoot(page, "asbuilt-member-record-editor");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
    });

    await inRole(browser, "member", MOBILE, async (page) => {
      await open(page, "/me", "asbuilt-member-me-mobile");
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
