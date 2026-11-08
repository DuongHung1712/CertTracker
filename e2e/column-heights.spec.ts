import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, signIn } from "./helpers";

// No manager-page height guard exists, so the brief's default applies (admin-fix-brief.md R1).
const MAX_COLUMN_GAP_PX = 350;

test("admin dashboard columns stay balanced at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, ADMIN_EMAIL);

  const ids = ["col-left", "col-center", "col-right"] as const;
  for (const id of ids) await expect(page.getByTestId(id)).toBeVisible();
  // The Explorer and the monthly chart render last; wait for them instead of a fixed delay.
  await expect(page.getByRole("region", { name: "Selected item details" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Certificates earned by month:/ })).toBeVisible();

  const heights = await page.evaluate((testIds) => {
    // Content height: from the column top to the bottom of its last child (grid stretch ignored).
    return testIds.map((id) => {
      const col = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const last = col?.lastElementChild;
      if (!col || !last) return 0;
      return last.getBoundingClientRect().bottom - col.getBoundingClientRect().top;
    });
  }, [...ids]);

  const gap = Math.max(...heights) - Math.min(...heights);
  expect(gap, `column heights ${ids.map((id, i) => `${id}=${Math.round(heights[i])}`).join(", ")}`).toBeLessThanOrEqual(
    MAX_COLUMN_GAP_PX,
  );
});
