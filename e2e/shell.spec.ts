import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("app shell", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  // This file's sign-ins occasionally lose a race against the other spec
  // files' concurrent sign-ins on the single-process Next dev server (all
  // requests reach Supabase and get a 200 — confirmed via the auth
  // container logs — so the retry is absorbing dev-server contention, not
  // a real app failure).
  test.describe.configure({ retries: 1 });

  test("does not scroll horizontally, even next to a wide table", async ({ page }) => {
    await signIn(page, "admin@certtracker.test");

    // No wide table exists in the shell yet — reproduce the shape of one
    // (design-system.md §7: only the table scrolls, never the page).
    await page.evaluate(() => {
      const host = document.getElementById("main-content");
      const wrap = document.createElement("div");
      wrap.className = "overflow-x-auto";
      wrap.innerHTML =
        '<table style="white-space:nowrap"><tr>' +
        Array.from({ length: 12 }, (_, i) => `<td style="padding:0 40px">Cột dữ liệu rất dài số ${i}</td>`).join("") +
        "</tr></table>";
      host?.appendChild(wrap);
    });

    const scrollsSideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(scrollsSideways).toBe(false);
  });

  test("closes the mobile drawer after navigating to another page", async ({ page }) => {
    await signIn(page, "admin@certtracker.test");

    await page.getByRole("button", { name: "Mở hoặc thu gọn menu" }).click();
    const drawer = page.locator('[data-mobile="true"]');
    await expect(drawer).toBeVisible();

    await drawer.getByRole("link", { name: "Khóa học" }).click();
    await expect(page).toHaveURL(/\/courses$/);
    await expect(drawer).toHaveCount(0);
  });
});
