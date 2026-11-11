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

/** The preview row for an Excel line number (its first cell). */
function previewRow(page: Page, line: number): Locator {
  return page.getByRole("row").filter({ has: page.getByRole("cell", { name: String(line), exact: true }) });
}

test("admin imports the legacy workbook", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, "admin@certtracker.test");
  await upload(page, FIRST_FILE, Buffer.from(buildLegacyWorkbook()));
  await expect(page).toHaveURL(BATCH_URL);

  await expect(page.getByText("Create 3 · Update 2 · Unchanged 0 · Error 3")).toBeVisible();
  await expect(previewRow(page, 10)).toContainText("Duplicate of row 8");
  await expect(previewRow(page, 11)).toContainText('Team "Team Ghost" not found');
  await expect(previewRow(page, 12)).toContainText('Unknown status "Failed"');

  await page.getByRole("button", { name: "Import 5 rows" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Import 5 rows" }).click();
  await expect(page.getByText("Imported: created 3, updated 2")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /Imported \d{2}\/\d{2}\/\d{4} at \d{2}:\d{2}/ })).toBeVisible();

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

  await expect(page.getByText("Create 0 · Update 0 · Unchanged 5 · Error 3")).toBeVisible();
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
  await expect(page.getByText(/^Will create: .*1 certificate, 1 course$/)).toBeVisible();

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
    await expect(page.getByText("Create 0 · Update 1 · Unchanged 0 · Error 1")).toBeVisible();
    await expect(previewRow(page, 3)).toContainText("This course does not prepare for NVIDIA Generative AI LLMs");

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
