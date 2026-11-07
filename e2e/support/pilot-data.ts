import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { buildSampleWorkbook, readCatalogueSql, rehearsalPeople } from "../../src/features/import/sample-workbook";
import { todayVn } from "../../src/lib/dates";
import { SEED_PROGRAM_ID } from "./manager-scopes";
import { signInAsSeedAdmin } from "./restore-seed";

/**
 * Data the pilot rehearsal needs: the three teams of the rehearsal file and the file itself, imported through `/import`.
 * Everything runs as the seeded admin through RLS; every cleanup verifies its deletes, because RLS turns a forbidden
 * delete into a silent no-op.
 */
export const REHEARSAL_TEAMS = ["Team Alpha", "Team Beta", "Team Gamma"];
export const REHEARSAL_EMAIL_LIKE = "person%@example.com";
const REHEARSAL_PEOPLE = 20;
const CATALOGUE_PATH = "supabase/catalog/courses.sql";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BATCH_URL = /\/import\/([0-9a-f-]{36})$/;

type Admin = Awaited<ReturnType<typeof signInAsSeedAdmin>>;
type CatalogueTable = "courses" | "providers" | "cert_types";
const CATALOGUE_TABLES: CatalogueTable[] = ["courses", "providers", "cert_types"];

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

async function deleteVerified(admin: Admin, table: CatalogueTable | "teams" | "members" | "import_batches", ids: string[]) {
  if (ids.length === 0) return;
  const deleted = must(await admin.from(table).delete().in("id", ids).select("id"), `delete ${table}`);
  if (deleted.length !== ids.length) throw new Error(`Left ${ids.length - deleted.length} ${table} rows behind (RLS refused a delete?).`);
}

/** Creates the rehearsal file's three teams under the seed program; the cleanup removes them. */
export async function createPilotTeams(): Promise<() => Promise<void>> {
  const admin = await signInAsSeedAdmin();
  // A crashed run can leave them behind; the unique (program, name) key would then refuse the insert.
  const leftovers = must(await admin.from("teams").select("id").in("name", REHEARSAL_TEAMS).eq("program_id", SEED_PROGRAM_ID), "read teams");
  await deleteVerified(admin, "teams", leftovers.map((team) => team.id));
  const teams = must(
    await admin
      .from("teams")
      .insert(REHEARSAL_TEAMS.map((name) => ({ name, program_id: SEED_PROGRAM_ID })))
      .select("id"),
    "create teams",
  );
  return async () => deleteVerified(await signInAsSeedAdmin(), "teams", teams.map((team) => team.id));
}

/** Uploads a workbook at `/import` as the signed-in admin, commits every row and returns the batch id. */
export async function importWorkbook(page: Page, fileName: string, bytes: Uint8Array): Promise<string> {
  await page.goto("/import");
  const submit = page.getByRole("button", { name: "Upload and check" });
  // A file chosen before hydration fires no React onChange, so retry until the form has picked it up.
  await expect(async () => {
    await page.getByLabel("Excel file").setInputFiles({ name: fileName, mimeType: XLSX_MIME, buffer: Buffer.from(bytes) });
    await expect(submit).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await submit.click();
  await expect(page).toHaveURL(BATCH_URL, { timeout: 30_000 });
  await expect(page.getByText(/· Error 0$/)).toBeVisible();
  await page.getByRole("button", { name: /^Import \d+ rows?$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Import data" }).click();
  await expect(page.getByText(/^Imported: created \d+, updated 0$/)).toBeVisible({ timeout: 30_000 });
  return BATCH_URL.exec(page.url())![1]!;
}

export async function deleteImportBatch(batchId: string) {
  await deleteVerified(await signInAsSeedAdmin(), "import_batches", [batchId]);
}

async function catalogueIds(admin: Admin): Promise<Record<CatalogueTable, Set<string>>> {
  const entries = await Promise.all(
    CATALOGUE_TABLES.map(async (table) => [table, new Set(must(await admin.from(table).select("id"), `read ${table}`).map((row) => row.id))] as const),
  );
  return Object.fromEntries(entries) as Record<CatalogueTable, Set<string>>;
}

/**
 * Builds the rehearsal file (20 people over the three teams, courses from the real catalogue), imports it as the
 * signed-in admin and returns a cleanup that removes the people, their certificates, the batch and the courses,
 * providers and certificate types that did not exist before the import.
 */
export async function importRehearsalFile(page: Page): Promise<() => Promise<void>> {
  const today = todayVn();
  const catalogue = readCatalogueSql(readFileSync(CATALOGUE_PATH, "utf8"));
  const before = await catalogueIds(await signInAsSeedAdmin());
  const batchId = await importWorkbook(page, `rehearsal-${Date.now()}.xlsx`, buildSampleWorkbook(rehearsalPeople(today, catalogue), catalogue, today));

  return async () => {
    const admin = await signInAsSeedAdmin();
    await deleteVerified(admin, "import_batches", [batchId]);
    const people = must(await admin.from("members").select("id").like("email", REHEARSAL_EMAIL_LIKE), "read rehearsal people");
    if (people.length !== REHEARSAL_PEOPLE) throw new Error(`Expected ${REHEARSAL_PEOPLE} rehearsal people, found ${people.length}.`);
    const memberIds = people.map((person) => person.id);
    must(await admin.from("training_records").delete().in("member_id", memberIds).select("id"), "delete rehearsal records");
    await deleteVerified(admin, "members", memberIds);
    // Child before parent: courses reference providers and certificate types.
    const after = await catalogueIds(admin);
    for (const table of CATALOGUE_TABLES) {
      await deleteVerified(admin, table, [...after[table]].filter((id) => !before[table].has(id)));
    }
  };
}
