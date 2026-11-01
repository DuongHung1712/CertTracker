import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("design showcase renders tokens and components", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Expiry status" })).toBeVisible();
  await expect(page.getByText("Expired").first()).toBeVisible();

  const table = page.getByRole("table").first();
  await expect(table.getByRole("row")).toHaveCount(7); // header + 6 sample rows
  await page.getByLabel("Search by name, code, course…").fill("Chau");
  await expect(table.getByRole("row")).toHaveCount(2);

  await page.getByRole("button", { name: "Open confirmation dialog" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
