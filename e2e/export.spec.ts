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

test.describe("catalogue export", () => {
  async function exportCatalogue(page: Page, link: "Export CSV" | "Export Excel") {
    await page.goto("/courses");
    const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: link }).click()]);
    return { bytes: await readFile(await file.path()), filename: file.suggestedFilename() };
  }

  test("admin exports the catalogue as CSV and Excel, without member data", async ({ page }) => {
    await signIn(page, "admin@certtracker.test");
    const csv = await exportCatalogue(page, "Export CSV");
    expect([...csv.bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = csv.bytes.toString("utf8");
    expect(text).toContain("Name,Kind,Certificate type,Provider,Level,Validity (months),Link,Granting course,Prepared by");
    expect(text).toContain("AWS Solutions Architect Associate");
    expect(text).not.toContain("Trần Thị Bình");
    expect(csv.filename).toMatch(/^certtracker-catalogue-\d{4}-\d{2}-\d{2}\.csv$/);

    const xlsx = await exportCatalogue(page, "Export Excel");
    const book = XLSX.read(xlsx.bytes);
    expect(book.SheetNames).toEqual(["Certificates", "Courses"]);
    const courses = XLSX.utils.sheet_to_json<string[]>(book.Sheets.Courses, { header: 1 });
    expect(courses[0]).toEqual(["Name", "Provider", "Prepares for", "Grants", "Cost", "Currency", "Duration (hours)", "Refundable", "Refund conditions", "Link"]);
    expect(courses.length).toBeGreaterThan(1);
  });

  for (const email of ["manager@certtracker.test", "member@certtracker.test"]) {
    test(`${email} has no export buttons and the route answers 403`, async ({ page }) => {
      await signIn(page, email);
      await page.goto("/courses");
      await expect(page.getByRole("link", { name: "Export CSV" })).toHaveCount(0);
      for (const format of ["csv", "xlsx"]) {
        const status = await page.evaluate(async (f) => (await fetch(`/api/export/catalogue?format=${f}`)).status, format);
        expect(status).toBe(403);
      }
    });
  }
});
