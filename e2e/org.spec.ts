import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin manages the org tree end to end", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/org");

  const dcName = `DC E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Thêm trung tâm" }).click();
  await page.getByLabel("Tên trung tâm").fill(dcName);
  await page.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("cell", { name: dcName })).toBeVisible();

  const programName = `Program E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Thêm chương trình" }).click();
  await page.getByLabel("Tên chương trình").fill(programName);
  await page.getByLabel("Trung tâm").click();
  await page.getByRole("option", { name: dcName }).click();
  await page.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("cell", { name: programName })).toBeVisible();

  // The DC now has a Program: deleting it must fail with the restricted message, not a raw Postgres error.
  // Scoped to the "Trung tâm (DC)" section: the Program table also has a "Trung tâm" column showing
  // this same DC name, so an unscoped `tr` filter on the page would match both tables' rows.
  const dcSection = page.locator("section", { has: page.getByRole("heading", { name: "Trung tâm (DC)" }) });
  await dcSection
    .locator("tr", { has: page.getByRole("cell", { name: dcName, exact: true }) })
    .getByRole("button", { name: "Xóa" })
    .click();
  await page.getByRole("button", { name: "Xóa trung tâm" }).click();
  await expect(page.getByText("Trung tâm đang có chương trình")).toBeVisible();
});

test("member has no write access to the org tree", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await expect(page.getByRole("link", { name: "Tổ chức" })).toHaveCount(0);

  // The nav link is hidden, but /org has no route guard — a Member who types the URL directly
  // must still land on a read-only page with no write controls (server-gated via canManage, not
  // just a client-side hide).
  await page.goto("/org");
  await expect(page.getByRole("heading", { name: "Tổ chức" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm trung tâm" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thêm chương trình" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thêm team" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sửa" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Xóa" })).toHaveCount(0);
});
