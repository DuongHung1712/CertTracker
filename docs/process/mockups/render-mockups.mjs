// Renders the PROPOSED mockups (docs/process/mockups/*.html) to docs/process/images/proposed-<name>.png.
// These are static HTML pages, not the running application: no server, no database, no sign-in.
//
// How to run (from the repository root):
//   node docs/process/mockups/render-mockups.mjs [outputDir]
//
// Needs Chromium for Playwright (the same one capture.mjs uses). The pages load the Be Vietnam Pro font from
// Google Fonts when online; offline they fall back to a system font and the layout shifts slightly.
// Exits non-zero if a page is missing, has no visible "PROPOSED MOCKUP" banner, or overflows 1440 x 900.

import { mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const OUT_DIR = resolve(process.argv[2] ?? resolve(ROOT, "docs/process/images"));
const VIEWPORT = { width: 1440, height: 900 };

const pages = readdirSync(HERE)
  .filter((f) => f.endsWith(".html"))
  .sort();

async function render(browser, file) {
  const name = file.replace(/\.html$/, "");
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(pathToFileURL(resolve(HERE, file)).href, { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);

    const banner = page.locator(".banner").first();
    await banner.waitFor({ state: "visible", timeout: 5_000 });
    const text = (await banner.innerText()).replace(/\s+/g, " ");
    if (!/PROPOSED MOCKUP/i.test(text) || !/not built/i.test(text)) {
      throw new Error(`${file}: banner text is "${text}"`);
    }

    const overflow = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
      font: document.fonts.check('14px "Be Vietnam Pro"'),
    }));
    if (overflow.w > VIEWPORT.width || overflow.h > VIEWPORT.height) {
      throw new Error(`${file}: page is ${overflow.w}x${overflow.h}, larger than ${VIEWPORT.width}x${VIEWPORT.height}`);
    }
    if (!overflow.font) console.warn(`warning: ${file}: Be Vietnam Pro not loaded (offline?), using a fallback font`);

    const out = resolve(OUT_DIR, `proposed-${name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    return { out, kb: Math.round(statSync(out).size / 1024) };
  } finally {
    await context.close();
  }
}

async function main() {
  if (pages.length === 0) throw new Error(`no .html files in ${HERE}`);
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let total = 0;
  try {
    for (const file of pages) {
      const { out, kb } = await render(browser, file);
      total += kb;
      console.log(`wrote ${out} (${kb} KB)`);
    }
  } finally {
    await browser.close();
  }
  console.log(`${pages.length} images, ${total} KB in total`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
