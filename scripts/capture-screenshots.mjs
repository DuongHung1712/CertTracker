import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const PHASE = process.argv[2] || "after";
const BASE_URL = process.env.BASE_URL || "http://localhost:3200";
const OUTPUT_DIR = resolve(process.cwd(), "docs/ui-polish");
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

const screens = [
  { name: "login", path: "/login", auth: false },
  { name: "set-password", path: "/set-password", auth: false },
  { name: "dashboard", path: "/dashboard", auth: true },
  { name: "records", path: "/records", auth: true },
  { name: "members", path: "/members", auth: true },
  { name: "courses", path: "/courses", auth: true },
  { name: "org", path: "/org", auth: true },
  { name: "me", path: "/me", auth: true },
  { name: "import", path: "/import", auth: true },
  { name: "data-quality", path: "/data-quality", auth: true },
  { name: "settings", path: "/settings", auth: true },
];

async function captureScreen(page, screenName, phase = "before") {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(vp);
    // Light
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.waitForTimeout(300);
    const lightPath = resolve(OUTPUT_DIR, `${screenName}-${phase}-${vpName}-light.png`);
    await page.screenshot({ path: lightPath, fullPage: false });

    // Dark
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(300);
    const darkPath = resolve(OUTPUT_DIR, `${screenName}-${phase}-${vpName}-dark.png`);
    await page.screenshot({ path: darkPath, fullPage: false });

    // Reset to light
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to login...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await captureScreen(page, "login", PHASE);

  await page.goto(`${BASE_URL}/set-password`, { waitUntil: "networkidle" });
  await captureScreen(page, "set-password", PHASE);

  // Sign in as admin
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill("admin@certtracker.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(1000);

  for (const screen of screens) {
    if (!screen.auth) continue;
    console.log(`Capturing ${screen.name}...`);
    await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await captureScreen(page, screen.name, PHASE);

    // Special sheets
    if (screen.name === "records") {
      const addBtn = page.getByRole("button", { name: "Add certificate" });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(500);
        await captureScreen(page, "records-add-sheet", PHASE);
        // close sheet
        const cancelBtn = page.getByRole("button", { name: "Cancel" });
        if (await cancelBtn.isVisible()) await cancelBtn.click();
        await page.waitForTimeout(300);
      }

      // Empty state via search filter
      const searchInput = page.getByPlaceholder(/Search by/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill("nonexistentqueryforaudit");
        await page.waitForTimeout(400);
        await captureScreen(page, "records-empty-state", PHASE);
        await searchInput.fill("");
        await page.waitForTimeout(300);
      }
    }

    if (screen.name === "members") {
      const addBtn = page.getByRole("button", { name: "Add member" });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(500);
        await captureScreen(page, "members-add-dialog", PHASE);
        const cancelBtn = page.getByRole("button", { name: "Cancel" });
        if (await cancelBtn.isVisible()) await cancelBtn.click();
        await page.waitForTimeout(300);
      }

      // Empty state via search filter
      const searchInput = page.getByPlaceholder(/Search by/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill("nonexistentmembername");
        await page.waitForTimeout(400);
        await captureScreen(page, "members-empty-state", PHASE);
        await searchInput.fill("");
        await page.waitForTimeout(300);
      }
    }

    if (screen.name === "courses") {
      const addBtn = page.getByRole("button", { name: "Add course" });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(500);
        await captureScreen(page, "courses-add-sheet", PHASE);
        const cancelBtn = page.getByRole("button", { name: "Cancel" });
        if (await cancelBtn.isVisible()) await cancelBtn.click();
        await page.waitForTimeout(300);
      }

      const searchInput = page.getByPlaceholder(/Search by/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill("nonexistentcoursename");
        await page.waitForTimeout(400);
        await captureScreen(page, "courses-empty-state", PHASE);
        await searchInput.fill("");
        await page.waitForTimeout(300);
      }
    }
  }

  await browser.close();
  console.log(`${PHASE} screenshots captured successfully!`);
}

run().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
