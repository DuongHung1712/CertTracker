import { expect, test, type Locator, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { buildLegacyWorkbook } from "../src/features/import/__fixtures__/legacy-workbook";
import { signIn } from "./helpers";
import { prepareSeedState, restoreSeed, signInAsSeedAdmin } from "./support/restore-seed";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BATCH_URL = /\/import\/[0-9a-f-]{36}$/;

// The spec commits the fixture, which creates and modifies data; it is put back in afterAll so the spec can be
// re-run on the same database and never leaks into the other specs (see support/restore-seed.ts).
test.describe.configure({ mode: "serial" });

let admin: Awaited<ReturnType<typeof signInAsSeedAdmin>>;
let seedRecords: Awaited<ReturnType<typeof prepareSeedState>>;

test.beforeAll(async () => {
  admin = await signInAsSeedAdmin();
  seedRecords = await prepareSeedState(admin);
});

test.afterAll(async () => {
  // `beforeAll` may have failed before the client existed; then there is nothing of ours to restore.
  if (admin && seedRecords) await restoreSeed(admin, seedRecords);
});

// Unique labels so assertions find this run's batches even when the history holds others.
const RUN = Date.now();
const FIRST_FILE = `legacy-${RUN}.xlsx`;
const SECOND_FILE = `legacy-${RUN}-lan-2.xlsx`;

async function upload(page: Page, name: string, buffer: Buffer) {
  await page.goto("/import");
  await page.getByLabel("File Excel").setInputFiles({ name, mimeType: XLSX_MIME, buffer });
  await page.getByRole("button", { name: "Tải lên và kiểm tra" }).click();
}

/** The preview row for an Excel line number (its first cell). */
function previewRow(page: Page, line: number): Locator {
  return page.getByRole("row").filter({ has: page.getByRole("cell", { name: String(line), exact: true }) });
}

test("admin imports the legacy workbook", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "admin@certtracker.test");
  await upload(page, FIRST_FILE, Buffer.from(buildLegacyWorkbook()));
  await expect(page).toHaveURL(BATCH_URL);

  await expect(page.getByText("Tạo mới 3 · Cập nhật 2 · Không đổi 0 · Lỗi 3")).toBeVisible();
  await expect(previewRow(page, 10)).toContainText("Trùng với dòng 8");
  await expect(previewRow(page, 11)).toContainText('Không tìm thấy team "Team Ghost"');
  await expect(previewRow(page, 12)).toContainText('Không nhận ra trạng thái "Failed"');

  await page.getByRole("button", { name: "Nhập 5 dòng" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Nhập dữ liệu" }).click();
  await expect(page.getByText("Đã nhập: tạo mới 3, cập nhật 2")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Đã nhập lúc" })).toBeVisible();

  await page.goto("/records");
  await expect(page.getByRole("cell", { name: "Phạm Thu Hà", exact: true })).toBeVisible();
  // The course cell also holds the provider ("Azure Fundamentals Microsoft"), so match the row.
  await expect(page.getByRole("row").filter({ hasText: "Phạm Thu Hà" }).filter({ hasText: "Azure Fundamentals" })).toBeVisible();
});

test("re-importing the same file changes nothing", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "admin@certtracker.test");
  await upload(page, SECOND_FILE, Buffer.from(buildLegacyWorkbook()));
  await expect(page).toHaveURL(BATCH_URL);

  await expect(page.getByText("Tạo mới 0 · Cập nhật 0 · Không đổi 5 · Lỗi 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nhập 0 dòng" })).toBeDisabled();

  await page.getByRole("button", { name: "Hủy lô" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Hủy lô" }).click();
  await expect(page.getByText("Đã hủy lô nhập")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Lô đã hủy." })).toBeVisible();

  // History: this run's two batches, found by file name (other batches may exist from earlier runs).
  await page.goto("/import");
  const committed = page.getByRole("row").filter({ hasText: FIRST_FILE });
  const discarded = page.getByRole("row").filter({ hasText: SECOND_FILE });
  await expect(committed).toContainText("Đã nhập");
  await expect(committed).toContainText("Tạo mới 3 · Cập nhật 2");
  await expect(discarded).toContainText("Đã hủy");
  await expect(committed.getByRole("link", { name: "Xem", exact: true })).toBeVisible();
});

test("a file without the required columns is rejected", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Tên", "Điểm"],
    ["An", 9],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const buffer = Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);

  await upload(page, "no-headers.xlsx", buffer);
  await expect(page.getByRole("alert").filter({ hasText: "Không tìm thấy hàng tiêu đề" })).toBeVisible();
  await expect(page).toHaveURL(/\/import$/);
});

test("non-admins cannot import", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  await page.goto("/import");
  await expect(page).toHaveURL(/\/dashboard$/);

  const response = await page.request.post("/api/import/parse", {
    multipart: { file: { name: "a.xlsx", mimeType: XLSX_MIME, buffer: Buffer.from(buildLegacyWorkbook()) } },
  });
  expect(response.status()).toBe(403);
});
