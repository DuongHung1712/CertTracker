import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3200";
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Password123!";
const OUTPUT_DIR = resolve(process.cwd(), "docs/ui-polish");
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
};

async function captureScreen(page, baseName) {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(vp);
    // Light
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.waitForTimeout(400);
    const lightPath = resolve(OUTPUT_DIR, `${baseName}-${vpName}-light.png`);
    await page.screenshot({ path: lightPath, fullPage: false });

    // Dark
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(400);
    const darkPath = resolve(OUTPUT_DIR, `${baseName}-${vpName}-dark.png`);
    await page.screenshot({ path: darkPath, fullPage: false });

    // Reset to light
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
  }
}

async function loginAs(page, email) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(600);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Admin dashboard
  console.log("Capturing Admin dashboard...");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, "admin@certtracker.test");
    await captureScreen(page, "dashboard-after");

    // Also switch to Popular courses and capture
    await page.getByRole("tab", { name: "Popular courses" }).click();
    await page.waitForTimeout(400);
    await captureScreen(page, "dashboard-courses-tab-after");

    await ctx.close();
  }

  // 2. Manager dashboard
  console.log("Capturing Manager dashboard...");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, "manager@certtracker.test");
    await captureScreen(page, "dashboard-manager-after");
    await ctx.close();
  }

  // 3. Member dashboard
  console.log("Capturing Member dashboard...");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, "member@certtracker.test");
    await captureScreen(page, "dashboard-member-after");
    await ctx.close();
  }

  // 4. Design page showcase
  console.log("Capturing Design page dashboard showcase...");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/design`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await captureScreen(page, "dashboard-design-demo");
    await ctx.close();
  }

  await browser.close();
  console.log("All dashboard screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
