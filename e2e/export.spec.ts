import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { signIn } from "./helpers";

/** Clicks an export link on /records and returns the downloaded file's bytes and suggested name. */
async function download(page: Page, linkName: "Export CSV" | "Export Excel") {
  await page.goto("/records");
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: linkName }).click()]);
  const path = await file.path();
  return { bytes: await readFile(path), filename: file.suggestedFilename() };
}

test("admin exports CSV with a BOM, English headers and Vietnamese names", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  const { bytes, filename } = await download(page, "Export CSV");

  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = bytes.toString("utf8");
  expect(text).toContain("Trần Thị Bình");
  expect(text).toContain("Completed");
  expect(filename).toMatch(/^certtracker-certificates-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("manager's export is limited to managed teams", async ({ page }) => {
  await signIn(page, "manager@certtracker.test");
  const { bytes } = await download(page, "Export CSV");

  const text = bytes.toString("utf8");
  expect(text).toContain("Nguyễn Văn An");
  expect(text).not.toContain("Trần Thị Bình");
});

test("Excel export is a valid workbook", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  const { bytes, filename } = await download(page, "Export Excel");

  expect(filename).toMatch(/^certtracker-certificates-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const book = XLSX.read(bytes);
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  expect(rows[0].slice(0, 6)).toEqual(["Code", "Full name", "Email", "Team", "Career role", "YoE"]);
  expect(rows[0].slice(6, 8)).toEqual(["Certificate", "Kind"]);
  expect(rows[0]).toContain("Course studied");
  expect(rows.length).toBeGreaterThan(1);
});
