import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, signIn } from "./helpers";

// Guards the three top columns above the Explorer row (the Explorer has its own full-width row). The manager page has the same guard (its Team readiness row is separate too).
const MAX_COLUMN_GAP_PX = 350;

async function columnGap(page: Page, ids: readonly string[]) {
  const heights = await page.evaluate((testIds) => {
    // Content height: from the column top to the bottom of its last child (grid stretch ignored).
    return testIds.map((id) => {
      const col = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const last = col?.lastElementChild;
      if (!col || !last) return 0;
      return last.getBoundingClientRect().bottom - col.getBoundingClientRect().top;
    });
  }, [...ids]);
  return { gap: Math.max(...heights) - Math.min(...heights), label: ids.map((id, i) => `${id}=${Math.round(heights[i])}`).join(", ") };
}

test("manager dashboard columns stay balanced at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "manager@certtracker.test");
  const ids = ["mgr-col-left", "mgr-col-center", "mgr-col-right"] as const;
  for (const id of ids) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByRole("img", { name: /^Certificates earned by month:/ })).toBeVisible();
  const { gap, label } = await columnGap(page, ids);
  expect(gap, `column heights ${label}`).toBeLessThanOrEqual(MAX_COLUMN_GAP_PX);
});

test("admin dashboard columns stay balanced at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, ADMIN_EMAIL);

  const ids = ["col-left", "col-center", "col-right"] as const;
  for (const id of ids) await expect(page.getByTestId(id)).toBeVisible();
  // The monthly chart renders last in the top area; wait for it and the Explorer instead of a fixed delay.
  await expect(page.getByRole("region", { name: "Selected item details" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Certificates earned by month:/ })).toBeVisible();

  const { gap, label } = await columnGap(page, ids);
  expect(gap, `column heights ${label}`).toBeLessThanOrEqual(MAX_COLUMN_GAP_PX);
});
