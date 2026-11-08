import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("measure column heights at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "admin@certtracker.test");

  const leftCol = page.locator('[data-testid="col-left"]');
  const centerCol = page.locator('[data-testid="col-center"]');
  const rightCol = page.locator('[data-testid="col-right"]');

  await expect(leftCol).toBeVisible();
  await expect(centerCol).toBeVisible();
  await expect(rightCol).toBeVisible();

  await page.waitForTimeout(1000);

  const [leftHeight, centerHeight, rightHeight] = await page.evaluate(() => {
    function getContentHeight(el: HTMLElement) {
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length === 0) return el.offsetHeight;
      const lastChild = children[children.length - 1];
      const elRect = el.getBoundingClientRect();
      const lastRect = lastChild.getBoundingClientRect();
      return lastRect.bottom - elRect.top;
    }

    const left = document.querySelector('[data-testid="col-left"]') as HTMLElement;
    const center = document.querySelector('[data-testid="col-center"]') as HTMLElement;
    const right = document.querySelector('[data-testid="col-right"]') as HTMLElement;

    return [getContentHeight(left), getContentHeight(center), getContentHeight(right)];
  });

  console.log(`MEASURED CONTENT COLUMN HEIGHTS AT 1440px:`);
  console.log(`Left Column Content: ${leftHeight.toFixed(1)}px`);
  console.log(`Center Column Content: ${centerHeight.toFixed(1)}px`);
  console.log(`Right Column Content: ${rightHeight.toFixed(1)}px`);

  const heights = [leftHeight, centerHeight, rightHeight];
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);
  const diff = maxHeight - minHeight;
  console.log(`Height Difference (Max - Min): ${diff.toFixed(1)}px`);
});
