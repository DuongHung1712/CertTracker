import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { fieldLabel, signIn } from "./helpers";
import { signInAsSeedAdmin } from "./support/restore-seed";

test.describe("Admin UX & Ergonomics Auditor Walkthrough", () => {
  test.setTimeout(90_000);

  test.beforeEach(async () => {
    const admin = await signInAsSeedAdmin();
    // Ensure clean state before each test
    await admin.from("import_batches").delete().like("file_name", "%qa-aux%");
    await admin.from("certificates").delete().like("name", "QA-AUX-%");
    await admin.from("courses").delete().like("name", "QA-AUX-%");
    await admin.from("providers").delete().like("name", "QA-AUX-%");
  });

  test.afterEach(async () => {
    const admin = await signInAsSeedAdmin();
    // Ensure clean state after each test
    await admin.from("import_batches").delete().like("file_name", "%qa-aux%");
    await admin.from("certificates").delete().like("name", "QA-AUX-%");
    await admin.from("courses").delete().like("name", "QA-AUX-%");
    await admin.from("providers").delete().like("name", "QA-AUX-%");
  });

  test("1. Export Workflow Walkthrough", async ({ page }) => {
    await signIn(page, "admin@certtracker.test");

    // 1.1 Check /records export links
    await page.goto("/records");
    const recordsCsv = page.getByRole("link", { name: "Export CSV" });
    const recordsXlsx = page.getByRole("link", { name: "Export Excel" });
    await expect(recordsCsv).toBeVisible();
    await expect(recordsXlsx).toBeVisible();

    // Download CSV from /records
    const [csvFile] = await Promise.all([
      page.waitForEvent("download"),
      recordsCsv.click(),
    ]);
    const csvPath = await csvFile.path();
    const csvBytes = await readFile(csvPath);
    const csvContent = csvBytes.toString("utf8");
    console.log("[UX AUDIT] /records CSV headers:", csvContent.split("\n")[0]);

    // Download Excel from /records
    const [xlsxFile] = await Promise.all([
      page.waitForEvent("download"),
      recordsXlsx.click(),
    ]);
    const xlsxPath = await xlsxFile.path();
    const xlsxBytes = await readFile(xlsxPath);
    const wb = XLSX.read(xlsxBytes);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    console.log("[UX AUDIT] /records Excel headers:", rows[0]);
    console.log("[UX AUDIT] /records Excel row count:", rows.length);

    // 1.2 Check /me export links for admin
    await page.goto("/me");
    const meCsv = page.getByRole("link", { name: "Export CSV" });
    const meXlsx = page.getByRole("link", { name: "Export Excel" });
    const meCsvCount = await meCsv.count();
    const meXlsxCount = await meXlsx.count();
    console.log("[UX AUDIT] /me export links count for admin:", { meCsvCount, meXlsxCount });

    // 1.3 Check /import export links
    await page.goto("/import");
    const importCsv = page.getByRole("link", { name: "Export CSV" });
    const importXlsx = page.getByRole("link", { name: "Export Excel" });
    await expect(importCsv).toBeVisible();
    await expect(importXlsx).toBeVisible();
    console.log("[UX AUDIT] /import export links visible in 'Export data' section: true");

    // 1.4 Check /courses export links in main page content
    await page.goto("/courses");
    const mainContent = page.locator("main");
    const coursesCsvInMain = mainContent.getByRole("link", { name: /Export/i });
    const coursesButtonsInMain = mainContent.getByRole("button", { name: /Export/i });
    const coursesCsvCount = await coursesCsvInMain.count();
    const coursesButtonsCount = await coursesButtonsInMain.count();
    console.log("[UX AUDIT] /courses main content export links/buttons count:", { coursesCsvCount, coursesButtonsCount });
  });

  test("2. Import Workflow Walkthrough", async ({ page }) => {
    await signIn(page, "admin@certtracker.test");
    await page.goto("/import");

    // 2.1 Sample template link
    const templateLink = page.getByRole("link", { name: "Download template" });
    await expect(templateLink).toBeVisible();
    const href = await templateLink.getAttribute("href");
    console.log("[UX AUDIT] Template link href:", href);

    // 2.2 Collapsible columns guide
    const guideSummary = page.getByText("Columns", { exact: true });
    await expect(guideSummary).toBeVisible();
    await guideSummary.click();
    const examOnlyNote = page.getByText(/Every new certificate created by an import is an exam certificate/i);
    await expect(examOnlyNote).toBeVisible();
    const courseStudiedGuide = page.getByText(/A course that already exists in the Catalogue and prepares for the certificate/i);
    await expect(courseStudiedGuide).toBeVisible();
    console.log("[UX AUDIT] Columns guide expanded successfully. Found exam-only note and course studied description.");

    // 2.3 Upload workbook - Test invalid file error handling
    const fileInput = page.getByLabel("Excel file");
    await fileInput.setInputFiles({
      name: "invalid.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Not an excel"),
    });
    const submitBtn = page.getByRole("button", { name: "Upload and check" });
    await submitBtn.click();
    const errorAlert = page.getByRole("alert").filter({ hasText: "Only Excel files" });
    await expect(errorAlert).toContainText("Only Excel files (.xlsx or .xls) are accepted.");
    console.log("[UX AUDIT] Invalid file format error message confirmed:", await errorAlert.textContent());

    // 2.4 Upload workbook with valid rows, near-duplicates, and new entities
    const aoa = [
      ["Email", "Certificate", "Full name", "Team", "Provider", "Certificate type", "Status", "Progress (%)", "Cost", "Currency"],
      // Row 2: Near duplicate of "AWS Solutions Architect Associate" ("AWS Solutions Architect - Associate")
      ["ha.pham@certtracker.test", "AWS Solutions Architect - Associate", "Phạm Thu Hà", "Team AI", "AWS", "Cloud", "Not started", 0, null, null],
      // Row 3: New certificate + provider + course (priced exam => creates course)
      ["ha.pham@certtracker.test", "QA-AUX-BrandNewCert", "Phạm Thu Hà", "Team AI", "QA-AUX-Provider", "Cloud", "In progress", 50, 200, "USD"],
      // Row 4: Row with error (unknown status)
      ["ha.pham@certtracker.test", "AWS Solutions Architect Associate", "Phạm Thu Hà", "Team AI", "AWS", "Cloud", "UnknownStatus", 0, null, null],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    await fileInput.setInputFiles({
      name: "qa-aux-test-import.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: buf,
    });
    await submitBtn.click();
    await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}$/);

    // 2.5 Preview screen inspection
    const countersText = await page.locator("p.tabular-nums").textContent();
    console.log("[UX AUDIT] Preview counters:", countersText);

    // New entities section
    const newEntities = page.getByTestId("new-entities");
    await expect(newEntities).toBeVisible();
    const newEntitiesText = await newEntities.textContent();
    console.log("[UX AUDIT] New entities preview text:", newEntitiesText);

    // Check course auto-creation note
    const courseNote = page.getByText("A course is created for a priced exam so its cost is tracked.");
    const courseNoteVisible = await courseNote.isVisible();
    console.log("[UX AUDIT] Course auto-creation note visible:", courseNoteVisible);

    // Near-duplicate warning
    const warning = page.locator("p:has-text('Check this is not a duplicate')");
    const warningCount = await warning.count();
    console.log("[UX AUDIT] Near-duplicate warning count:", warningCount);
    if (warningCount > 0) {
      console.log("[UX AUDIT] Near-duplicate warning text:", await warning.first().textContent());
    }

    // 2.6 Inspect Import button & Confirm dialog steps
    const importBtn = page.getByRole("button", { name: /Import \d+ rows?/ });
    await expect(importBtn).toBeVisible();
    console.log("[UX AUDIT] Import button label:", await importBtn.textContent());
    await importBtn.click();

    const commitDialog = page.getByRole("alertdialog");
    await expect(commitDialog).toBeVisible();
    console.log("[UX AUDIT] Confirm dialog title:", await commitDialog.getByRole("heading", { level: 2 }).first().textContent());
    console.log("[UX AUDIT] Confirm dialog description:", await commitDialog.locator("p").first().textContent());
    // Cancel out of commit dialog
    await commitDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(commitDialog).toBeHidden();

    // 2.7 Discard batch flow
    const discardBtn = page.getByRole("button", { name: "Discard batch" });
    await discardBtn.click();
    const discardDialog = page.getByRole("alertdialog");
    await expect(discardDialog).toBeVisible();
    console.log("[UX AUDIT] Discard dialog title:", await discardDialog.getByRole("heading").textContent());
    await discardDialog.getByRole("button", { name: "Discard batch" }).click();
    await expect(page.getByText("Discarded batch")).toBeVisible();
    console.log("[UX AUDIT] Discard completed successfully in 2 clicks.");
  });

  test("3. Catalogue Management Walkthrough (/courses)", async ({ page }) => {
    await signIn(page, "admin@certtracker.test");
    await page.goto("/courses");

    // 3.1 Adding an Exam Certificate
    await page.getByRole("tab", { name: "Certificates" }).click();
    await page.getByRole("button", { name: "Add certificate or course completion" }).click();
    const certDialog = page.getByRole("dialog");
    await expect(certDialog).toBeVisible();

    console.log("[UX AUDIT] Add Certificate sheet title:", await certDialog.getByRole("heading").textContent());
    await certDialog.getByLabel(fieldLabel("Name")).fill("QA-AUX-Exam-1");
    // Select Type
    await certDialog.getByLabel(fieldLabel("Type")).click();
    await page.getByRole("option", { name: "Cloud", exact: true }).click();
    // Select Provider
    await certDialog.getByLabel(fieldLabel("Provider")).click();
    await page.getByRole("option", { name: "AWS", exact: true }).click();
    // Fill level, validity, url
    await certDialog.getByLabel("Level").fill("Foundational");
    await certDialog.getByLabel("Validity (months)").fill("36");
    await certDialog.getByLabel("Link").fill("https://example.com/exam1");

    await certDialog.getByRole("button", { name: "Save" }).click();
    await expect(certDialog).toBeHidden();
    await expect(page.getByText("Added certificate QA-AUX-Exam-1")).toBeVisible();
    console.log("[UX AUDIT] Exam certificate QA-AUX-Exam-1 created.");

    // 3.2 Adding a Course
    await page.getByRole("tab", { name: "Courses" }).click();
    await page.getByRole("button", { name: "Add course" }).click();
    const courseDialog = page.getByRole("dialog");
    await expect(courseDialog).toBeVisible();
    console.log("[UX AUDIT] Add Course sheet title:", await courseDialog.getByRole("heading").textContent());

    await courseDialog.getByLabel(fieldLabel("Name")).fill("QA-AUX-Course-1");
    await courseDialog.getByLabel(fieldLabel("Provider")).click();
    await page.getByRole("option", { name: "AWS", exact: true }).click();

    // Check "Prepares for" dropdown
    await courseDialog.getByLabel("Prepares for").click();
    await expect(page.getByRole("option", { name: "QA-AUX-Exam-1" })).toBeVisible();
    await page.getByRole("option", { name: "QA-AUX-Exam-1" }).click();

    // Fill cost & currency
    await courseDialog.getByLabel("Cost").fill("100");
    await courseDialog.getByLabel("Currency").click();
    await page.getByRole("option", { name: "USD" }).click();

    // Duration & refundable switch
    await courseDialog.getByLabel("Duration (hours)").fill("20");
    const refundableSwitch = courseDialog.getByRole("switch", { name: "Refundable" });
    await refundableSwitch.click();
    await courseDialog.getByLabel("Refund conditions").fill("Pass test on first try");

    await courseDialog.getByRole("button", { name: "Save" }).click();
    await expect(courseDialog).toBeHidden();
    await expect(page.getByText("Added course QA-AUX-Course-1")).toBeVisible();
    console.log("[UX AUDIT] Course QA-AUX-Course-1 created with Prepares for QA-AUX-Exam-1.");

    // 3.3 Adding a Course Completion (2-Step Process Walkthrough)
    console.log("[UX AUDIT] Testing 2-step process for Course Completion...");
    // Step 1: Must create Course first in Courses tab
    await page.getByRole("button", { name: "Add course" }).click();
    const c2Dialog = page.getByRole("dialog");
    await c2Dialog.getByLabel(fieldLabel("Name")).fill("QA-AUX-Course-2-Granting");
    await c2Dialog.getByLabel(fieldLabel("Provider")).click();
    await page.getByRole("option", { name: "AWS", exact: true }).click();
    await c2Dialog.getByRole("button", { name: "Save" }).click();
    await expect(c2Dialog).toBeHidden();
    await expect(page.getByText("Added course QA-AUX-Course-2-Granting")).toBeVisible();

    // Step 2: Go to Certificates tab and create Course Completion linked to QA-AUX-Course-2-Granting
    await page.getByRole("tab", { name: "Certificates" }).click();
    await page.getByRole("button", { name: "Add certificate or course completion" }).click();
    const compDialog = page.getByRole("dialog");
    
    // Switch Kind from Exam to Course completion
    await compDialog.getByLabel(fieldLabel("Kind")).click();
    await page.getByRole("option", { name: "Course completion" }).click();

    // Fill Name again
    await compDialog.getByLabel(fieldLabel("Name")).fill("QA-AUX-Completion-2");
    // Must select Type again
    await compDialog.getByLabel(fieldLabel("Type")).click();
    await page.getByRole("option", { name: "Cloud", exact: true }).click();
    // Must select Provider again
    await compDialog.getByLabel(fieldLabel("Provider")).click();
    await page.getByRole("option", { name: "AWS", exact: true }).click();
    // Pick granting course from combobox
    await compDialog.getByLabel(fieldLabel("Course")).click();
    await page.getByRole("option", { name: "QA-AUX-Course-2-Granting" }).click();

    // Notice: Validity is hidden!
    await expect(compDialog.getByLabel("Validity (months)")).toHaveCount(0);

    await compDialog.getByRole("button", { name: "Save" }).click();
    await expect(compDialog).toBeHidden();
    await expect(page.getByText("Added course completion QA-AUX-Completion-2")).toBeVisible();
    console.log("[UX AUDIT] Course Completion QA-AUX-Completion-2 successfully created via 2-step process.");

    // 3.4 Foreign Key Protection & Deletion Checks
    // Check 1: Try deleting QA-AUX-Course-2-Granting while it grants QA-AUX-Completion-2
    await page.getByRole("tab", { name: "Courses" }).click();
    await page.getByRole("searchbox").fill("QA-AUX-Course-2-Granting");
    const courseRow = page.getByRole("row").filter({ hasText: "QA-AUX-Course-2-Granting" });
    await courseRow.getByRole("button", { name: /Actions for QA-AUX-Course-2-Granting/i }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const deleteCourseDialog = page.getByRole("alertdialog");
    await expect(deleteCourseDialog).toBeVisible();
    const deleteCourseDesc = await deleteCourseDialog.locator("p").textContent();
    console.log("[UX AUDIT] Delete course warning description:", deleteCourseDesc);
    const deleteCourseBtn = deleteCourseDialog.getByRole("button", { name: "Delete course" });
    const isDeleteCourseDisabled = await deleteCourseBtn.isDisabled();
    console.log("[UX AUDIT] Is Delete course button disabled when granting completion?", isDeleteCourseDisabled);
    expect(isDeleteCourseDisabled).toBe(true);
    await deleteCourseDialog.getByRole("button", { name: "Cancel" }).click();

    // Check 2: Try deleting a certificate that members hold (AWS Solutions Architect Associate)
    await page.getByRole("tab", { name: "Certificates" }).click();
    await page.getByRole("searchbox").fill("AWS Solutions Architect Associate");
    const heldCertRow = page.getByRole("row").filter({ hasText: "AWS Solutions Architect Associate" }).first();
    await heldCertRow.getByRole("button", { name: /Actions for AWS Solutions Architect Associate/i }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const deleteCertDialog = page.getByRole("alertdialog");
    await expect(deleteCertDialog).toBeVisible();
    console.log("[UX AUDIT] Delete certificate hint:", await deleteCertDialog.locator("p").textContent());
    await deleteCertDialog.getByRole("button", { name: "Delete certificate" }).click();

    // Verify error toast/message
    const errorToast = page.getByText("Members already hold this. Delete their entries first.");
    await expect(errorToast).toBeVisible();
    console.log("[UX AUDIT] FK protection message verified:", await errorToast.textContent());
  });
});
