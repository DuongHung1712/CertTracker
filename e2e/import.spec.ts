import { readFileSync } from "node:fs";
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
  const submit = page.getByRole("button", { name: "Upload and check" });
  // A file chosen before hydration fires no React onChange, so retry until the form has picked it up.
  await expect(async () => {
    await page.getByLabel("Excel file").setInputFiles({ name, mimeType: XLSX_MIME, buffer });
    await expect(submit).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await submit.click();
}

async function expectCounts(page: Page, create: number, update: number, unchanged: number, error: number) {
  for (const [label, n] of [["Create", create], ["Update", update], ["Unchanged", unchanged], ["Error", error]] as const) {
    await expect(page.getByRole("button", { name: `${label} ${n}`, exact: true })).toBeVisible();
  }
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

  await expectCounts(page, 3, 2, 0, 3);
  // The Error pill filters the preview down to the failing rows.
  await page.getByRole("button", { name: "Error 3", exact: true }).click();
  await expect(page.getByRole("button", { name: "Error 3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(previewRow(page, 10)).toContainText("Duplicate of row 8");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "Error 3", exact: true }).click();
  await expect(previewRow(page, 11)).toContainText('Team: "Team Ghost" not found.');
  await expect(previewRow(page, 12)).toContainText('"Failed" is not a known status.');
  // Errors name their column and quote the value.
  await expect(previewRow(page, 12)).toContainText(/Trạng thái|Status/);

  // The page names what it will create, by provider / certificate with the rows that need it.
  const newEntries = page.getByTestId("new-entities");
  await expect(newEntries.getByRole("heading", { name: "Will be created" })).toBeVisible();
  await expect(newEntries.getByRole("region", { name: "Providers" })).toContainText("Microsoft");
  await expect(newEntries.getByRole("region", { name: "Certificates" })).toContainText("Azure Fundamentals");

  await page.getByRole("button", { name: "Import 5 rows" }).click();
  const dialog = page.getByRole("alertdialog");
  // The rules are stated apart, the list is repeated, and the confirmation is not styled as destructive.
  await expect(dialog).toContainText("3 rows with errors are left out of this import");
  await expect(dialog).toContainText("The import either completes in full or changes nothing.");
  await expect(dialog).not.toContainText("will be skipped");
  await expect(dialog.getByTestId("new-entities")).toContainText("Microsoft");
  const confirm = dialog.getByRole("button", { name: "Import 5 rows" });
  await expect(confirm).toHaveClass(/(^| )bg-primary( |$)/);
  await confirm.click();
  await expect(page.getByText("Imported: created 3, updated 2")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /Imported \d{2}\/\d{2}\/\d{4} at \d{2}:\d{2}/ })).toBeVisible();

  await page.goto("/records");
  await expect(page.getByRole("button", { name: /Phạm Thu Hà/ }).first()).toBeVisible();
  // The course cell also holds the provider ("Azure Fundamentals Microsoft"), so match the row.
  await expect(page.getByRole("row").filter({ hasText: "Phạm Thu Hà" }).filter({ hasText: "Azure Fundamentals" })).toBeVisible();
});

test("re-importing the same file changes nothing", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "admin@certtracker.test");
  await upload(page, SECOND_FILE, Buffer.from(buildLegacyWorkbook()));
  await expect(page).toHaveURL(BATCH_URL);

  await expectCounts(page, 0, 0, 5, 3);
  await expect(page.getByRole("button", { name: "Import 0 rows" })).toBeDisabled();

  await page.getByRole("button", { name: "Discard batch" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard batch" }).click();
  await expect(page.getByText("Discarded batch")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "This batch was discarded." })).toBeVisible();

  // History: this run's two batches, found by file name (other batches may exist from earlier runs).
  await page.goto("/import");
  const committed = page.getByRole("row").filter({ hasText: FIRST_FILE });
  const discarded = page.getByRole("row").filter({ hasText: SECOND_FILE });
  await expect(committed).toContainText("Imported");
  await expect(committed).toContainText("Created 3 · Updated 2");
  await expect(discarded).toContainText("Discarded");
  await expect(committed.getByRole("link", { name: /^View/ })).toBeVisible();
});

test("a new certificate with a cost brings its own course, shown in the preview and created on import", async ({ page }) => {
  test.setTimeout(60_000);
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Email", "Certificate", "Provider", "Cost", "Currency", "Duration (hours)", "Status"],
    ["an@certtracker.test", `Microsoft Priced Exam ${RUN}`, "Microsoft", 165, "USD", 20, "Not started"],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  await signIn(page, "admin@certtracker.test");
  await upload(page, `priced-${RUN}.xlsx`, Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer));
  await expect(page).toHaveURL(BATCH_URL);
  const newEntries = page.getByTestId("new-entities");
  await expect(newEntries.getByRole("region", { name: "Certificates" })).toContainText(`Microsoft Priced Exam ${RUN}`);
  await expect(newEntries.getByRole("region", { name: "Courses" })).toContainText(`Microsoft Priced Exam ${RUN}`);
  await expect(newEntries).toContainText("A course is created for a priced exam so its cost is tracked.");

  await page.getByRole("button", { name: "Import 1 row" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Import 1 row" }).click();
  await expect(page.getByText("Imported: created 1, updated 0")).toBeVisible();
  const { data: course } = await admin.from("courses").select("id, prepares_for_id, cost, cost_currency, est_hours").like("name", `Microsoft Priced Exam ${RUN}`).single();
  expect(course).toMatchObject({ cost: 165, cost_currency: "USD", est_hours: 20 });
  // Spec 4.4: the new course is the course studied of the imported record.
  const AN = "5eed0000-0000-0000-0000-00000000b001";
  const { data: record } = await admin.from("training_records").select("course_id").eq("member_id", AN).eq("certificate_id", course!.prepares_for_id!).single();
  expect(record?.course_id).toBe(course?.id);
});

test("a course studied is saved on the record, and a course that does not prepare for the certificate is a row error", async ({ page }) => {
  test.setTimeout(90_000);
  const SAA = "5eed0000-0000-0000-0000-00000000e001";
  const AWS_PROVIDER = "5eed0000-0000-0000-0000-00000000c101";
  const CHAU = "5eed0000-0000-0000-0000-00000000b003";
  const courseName = `Studied E2E ${RUN}`;
  const unrelatedName = `Unrelated E2E ${RUN}`;
  const { data: course } = await admin.from("courses").insert({ name: courseName, provider_id: AWS_PROVIDER, prepares_for_id: SAA }).select("id").single();
  const { data: unrelated } = await admin.from("courses").insert({ name: unrelatedName, provider_id: AWS_PROVIDER }).select("id").single();
  try {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Email", "Certificate", "Provider", "Course studied", "Status", "Progress (%)"],
      ["member@certtracker.test", "AWS Solutions Architect Associate", "AWS", courseName, "Not started", 0],
      ["binh@certtracker.test", "NVIDIA Generative AI LLMs", "NVIDIA", unrelatedName, "In progress", 40],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
    await signIn(page, "admin@certtracker.test");
    await upload(page, `studied-${RUN}.xlsx`, Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer));
    await expect(page).toHaveURL(BATCH_URL);
    await expectCounts(page, 0, 1, 0, 1);
    await expect(previewRow(page, 3)).toContainText(`Course studied: "${unrelatedName}" does not prepare for "NVIDIA Generative AI LLMs".`);

    await page.getByRole("button", { name: "Import 1 row" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Import 1 row" }).click();
    await expect(page.getByText("Imported: created 0, updated 1")).toBeVisible();
    const { data: record } = await admin.from("training_records").select("course_id").eq("member_id", CHAU).eq("certificate_id", SAA).single();
    expect(record?.course_id).toBe(course?.id);
  } finally {
    // The seed restore in afterAll gives Châu's record its own course back; here only the courses go, errors included.
    for (const created of [course, unrelated]) {
      if (!created) continue;
      const { error } = await admin.from("courses").delete().eq("id", created.id);
      if (error) throw new Error(`delete e2e course: ${error.message}`);
    }
  }
});

/** A one-sheet workbook from rows of cells. */
function workbook(rows: (string | number)[][]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

test("the page offers the template and a columns guide, and the template imports without errors", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "admin@certtracker.test");
  await page.goto("/import");

  const guide = page.getByTestId("columns-guide");
  await expect(guide).not.toHaveAttribute("open", "");
  await guide.getByText("Columns", { exact: true }).click();
  await expect(guide.getByText("Every new certificate created by an import is an exam certificate. Add course completions in the Catalogue.")).toBeVisible();
  await expect(guide.getByText("Required").first()).toBeVisible();
  await expect(guide).toContainText("Course studied");
  await expect(guide).toContainText("dd/mm/yyyy");
  await expect(guide).toContainText("Also accepted:");

  const link = page.getByRole("link", { name: "Download template" });
  await expect(link).toHaveAttribute("href", "/templates/certificates-import.xlsx");
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const path = await download.path();
  expect(download.suggestedFilename()).toBe("certificates-import.xlsx");

  // Re-uploading the downloaded file: no row error, and the example entries are named in the preview.
  await upload(page, "template.xlsx", readFileSync(path));
  await expect(page).toHaveURL(BATCH_URL);
  await expectCounts(page, 3, 0, 0, 0);
  await expect(page.getByTestId("new-entities").getByRole("region", { name: "Certificates" })).toContainText("Example Cloud Practitioner");
  await page.getByRole("button", { name: "Discard batch" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard batch" }).click();
  await expect(page.getByText("Discarded batch")).toBeVisible();
});

test("a new name that nearly duplicates an existing one is flagged in the preview", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "admin@certtracker.test");
  // "A.W.S" is not the existing provider "AWS" to the importer (punctuation differs), but a person would call it a duplicate.
  await upload(
    page,
    `near-duplicate-${RUN}.xlsx`,
    workbook([
      ["Email", "Certificate", "Provider", "Status"],
      ["an@certtracker.test", `Near Duplicate ${RUN}`, "A.W.S", "Not started"],
    ]),
  );
  await expect(page).toHaveURL(BATCH_URL);
  const providers = page.getByTestId("new-entities").getByRole("region", { name: "Providers" });
  await expect(providers).toContainText("A.W.S");
  await expect(providers).toContainText('Looks like "AWS", which already exists.');
  await page.getByRole("button", { name: "Discard batch" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard batch" }).click();
  await expect(page.getByText("Discarded batch")).toBeVisible();
});

test("at 375 px the preview stacks each row as a card and nothing scrolls the page sideways", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "admin@certtracker.test");
  await page.setViewportSize({ width: 375, height: 812 });
  const noSidewaysScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  await page.goto("/import");
  await page.getByTestId("columns-guide").getByText("Columns", { exact: true }).click();
  expect(await noSidewaysScroll()).toBe(true);

  const longName = `Unbroken${"x".repeat(90)}${RUN}`;
  await upload(
    page,
    `narrow-${RUN}.xlsx`,
    workbook([
      ["Email", "Certificate", "Provider", "Course studied", "Status"],
      ["an@certtracker.test", longName, "AWS", `No Such Course ${RUN}`, "Failed"],
    ]),
  );
  await expect(page).toHaveURL(BATCH_URL);
  const cards = page.getByTestId("row-cards");
  await expect(cards).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
  const card = cards.getByRole("listitem").filter({ hasText: "Row 2" }).first();
  await expect(card).toContainText("Error");
  await expect(card).toContainText(`Course studied: No Such Course ${RUN}`);
  await expect(card).toContainText(`Course studied: "No Such Course ${RUN}" not found.`);
  await expect(card).toContainText('Status: "Failed" is not a known status.');
  expect(await noSidewaysScroll()).toBe(true);
  await page.getByRole("button", { name: "Discard batch" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.getByRole("button", { name: "Discard batch" }).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await dialog.getByRole("button", { name: "Discard batch" }).click();
  await expect(page.getByText("Discarded batch")).toBeVisible();
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
  await expect(page.getByRole("alert").filter({ hasText: "No header row with an Email column" })).toBeVisible();
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

test("the Excel dropzone shows the chosen file, can remove it, and explains rejected files", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/import");
  const submit = page.getByRole("button", { name: "Upload and check" });
  const picker = page.getByLabel("Excel file");
  const alert = page.getByRole("alert");
  await expect(submit).toBeDisabled();

  await expect(async () => {
    await picker.setInputFiles({ name: "plan.xlsx", mimeType: XLSX_MIME, buffer: Buffer.alloc(2048, 1) });
    await expect(page.getByText("plan.xlsx")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText("(2 KB)")).toBeVisible();
  await expect(submit).toBeEnabled();
  await page.getByRole("button", { name: "Remove file" }).click();
  await expect(page.getByText("plan.xlsx")).toHaveCount(0);
  await expect(submit).toBeDisabled();

  await picker.setInputFiles({ name: "notes.csv", mimeType: "text/csv", buffer: Buffer.from("a,b") });
  await expect(alert.filter({ hasText: "Only Excel files (.xlsx or .xls) are accepted." })).toBeVisible();
  await picker.setInputFiles({ name: "empty.xlsx", mimeType: XLSX_MIME, buffer: Buffer.alloc(0) });
  await expect(alert.filter({ hasText: "The file is empty." })).toBeVisible();
  await picker.setInputFiles({ name: "big.xlsx", mimeType: XLSX_MIME, buffer: Buffer.alloc(4 * 1024 * 1024 + 1) });
  await expect(alert.filter({ hasText: "The file is larger than 4 MB." })).toBeVisible();
  await expect(submit).toBeDisabled();
});
