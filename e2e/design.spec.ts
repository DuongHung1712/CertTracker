import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("design showcase renders tokens and components", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");

  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Trạng thái hết hạn" })).toBeVisible();
  await expect(page.getByText("Đã hết hạn").first()).toBeVisible();

  const table = page.getByRole("table").first();
  await expect(table.getByRole("row")).toHaveCount(7); // header + 6 sample rows
  await page.getByLabel("Tìm theo tên, mã, khóa học…").fill("Châu");
  await expect(table.getByRole("row")).toHaveCount(2);

  await page.getByRole("button", { name: "Mở hộp thoại xác nhận" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});
