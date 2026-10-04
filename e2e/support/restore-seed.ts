import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "../../src/lib/assert-local-supabase-url";
import type { Database } from "../../src/types/database";
import { SEED_PASSWORD } from "../helpers";

/**
 * Puts the data the legacy-workbook import touches back to its `supabase/seed.sql` state, so the import spec
 * can be re-run on the same database and never leaks rows into the other specs.
 *
 * Runs as the seeded admin through RLS (no service-role key anywhere); every delete is verified afterwards
 * because RLS turns a forbidden delete into a silent no-op.
 */

type Client = SupabaseClient<Database>;
type RecordRow = Database["public"]["Tables"]["training_records"]["Row"];
type SeedRecord = Pick<
  RecordRow,
  | "member_id"
  | "course_id"
  | "status"
  | "progress"
  | "planned_exam_date"
  | "issued_date"
  | "certificate_url"
  | "evidence_path"
  | "via_company"
  | "refund_status"
  | "notes"
>;

/** What the fixture import creates (see LEGACY_EXPECTED): one member and two providers (and their courses). */
const IMPORTED_MEMBER_EMAIL = "ha.pham@certtracker.test";
const IMPORTED_PROVIDERS = ["Google", "Microsoft"];
const SEED_MEMBER_IDS = [
  "5eed0000-0000-0000-0000-00000000b001",
  "5eed0000-0000-0000-0000-00000000b002",
  "5eed0000-0000-0000-0000-00000000b003",
];
const SEED_COURSE_IDS = ["5eed0000-0000-0000-0000-00000000e001", "5eed0000-0000-0000-0000-00000000e002"];
const SEED_RECORD_COUNT = 3;

const RECORD_COLUMNS =
  "member_id, course_id, status, progress, planned_exam_date, issued_date, certificate_url, evidence_path, via_company, refund_status, notes";

// Seed dates are relative to the day of `supabase db reset`, so the seed values are captured from the pristine
// database instead of being recomputed. The file survives a crashed run; it is removed after a successful restore.
const SNAPSHOT_FILE = path.join(tmpdir(), "certtracker-e2e-import-seed-snapshot.json");

function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

/** The Playwright process does not load `.env.local` (only Next does), so read it here when the env is not set. */
function supabaseConfig(): { url: string; anonKey: string } {
  const fromFile = { ...readEnvFile(path.resolve(__dirname, "../../.env.local")), ...readEnvFile(path.resolve(".env.local")) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromFile.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fromFile.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set (env or .env.local); `pnpm supabase status` prints it.");
  return { url, anonKey };
}

/**
 * A client signed in as a seeded user with the anon key — the same access the browser has, so RLS and function
 * grants apply. Every client the e2e helpers create comes from here, so none is reachable without the local-URL check.
 */
export async function signInAsSeedUser(email: string): Promise<Client> {
  const { url, anonKey } = supabaseConfig();
  assertLocalSupabaseUrl(url);
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`Seed sign-in as ${email} failed: ${error.message}`);
  return client;
}

export function signInAsSeedAdmin(): Promise<Client> {
  return signInAsSeedUser("admin@certtracker.test");
}

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: no data`);
  return result.data;
}

async function importedIds(client: Client) {
  const members = check(await client.from("members").select("id").eq("email", IMPORTED_MEMBER_EMAIL), "read imported member");
  const providers = check(await client.from("providers").select("id").in("name", IMPORTED_PROVIDERS), "read imported providers");
  const courses =
    providers.length === 0
      ? []
      : check(
          await client.from("courses").select("id").in("provider_id", providers.map((provider) => provider.id)),
          "read imported courses",
        );
  return {
    memberIds: members.map((member) => member.id),
    providerIds: providers.map((provider) => provider.id),
    courseIds: courses.map((course) => course.id),
  };
}

async function readSeedRecords(client: Client): Promise<SeedRecord[]> {
  const rows = check(
    await client.from("training_records").select(RECORD_COLUMNS).in("member_id", SEED_MEMBER_IDS).in("course_id", SEED_COURSE_IDS),
    "read seed records",
  );
  return rows.sort((a, b) => `${a.member_id}${a.course_id}`.localeCompare(`${b.member_id}${b.course_id}`));
}

/**
 * Call before the first import. On a pristine database it captures the seed records; on a dirty one (a previous
 * run crashed before restoring) it reuses the captured file and restores first, so the run starts from the seed.
 */
export async function prepareSeedState(client: Client): Promise<SeedRecord[]> {
  const { memberIds, providerIds } = await importedIds(client);
  if (memberIds.length === 0 && providerIds.length === 0) {
    const records = await readSeedRecords(client);
    if (records.length !== SEED_RECORD_COUNT) {
      throw new Error(`Expected the ${SEED_RECORD_COUNT} seed records, found ${records.length}; run \`pnpm supabase db reset\`.`);
    }
    writeFileSync(SNAPSHOT_FILE, JSON.stringify(records));
    return records;
  }
  if (!existsSync(SNAPSHOT_FILE)) {
    throw new Error("The database holds imported data but no seed snapshot exists; run `pnpm supabase db reset`.");
  }
  const records = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as SeedRecord[];
  await restoreSeed(client, records);
  return records;
}

/** Deletes what the import created and puts the seed records back. Idempotent; throws if anything is left behind. */
export async function restoreSeed(client: Client, seedRecords: SeedRecord[]): Promise<void> {
  // The spec only creates batches (rows cascade); the seed has none, so remove them all, including leftovers.
  check(await client.from("import_batches").delete().not("id", "is", null).select("id"), "delete import batches");

  const { memberIds, providerIds, courseIds } = await importedIds(client);
  if (memberIds.length > 0) {
    check(await client.from("training_records").delete().in("member_id", memberIds).select("id"), "delete imported member records");
  }
  if (courseIds.length > 0) {
    check(await client.from("training_records").delete().in("course_id", courseIds).select("id"), "delete imported course records");
    check(await client.from("courses").delete().in("id", courseIds).select("id"), "delete imported courses");
  }
  if (providerIds.length > 0) check(await client.from("providers").delete().in("id", providerIds).select("id"), "delete imported providers");
  if (memberIds.length > 0) check(await client.from("members").delete().in("id", memberIds).select("id"), "delete imported member");

  // Seed records the import updated (An: issued date; Bình: progress, planned date, notes).
  for (const { member_id, course_id, ...seed } of seedRecords) {
    const updated = check(
      await client.from("training_records").update(seed).eq("member_id", member_id).eq("course_id", course_id).select("id"),
      "restore seed record",
    );
    if (updated.length !== 1) throw new Error(`Seed record ${member_id}|${course_id} not found (RLS refused the update?).`);
  }

  // RLS turns a forbidden delete into a silent no-op, so prove the result.
  const left = await importedIds(client);
  if (left.memberIds.length + left.providerIds.length + left.courseIds.length > 0) {
    throw new Error("restoreSeed left imported members/providers/courses behind (RLS refused a delete?).");
  }
  if (check(await client.from("import_batches").select("id"), "verify import batches").length > 0) {
    throw new Error("restoreSeed left import batches behind.");
  }
  const total = check(await client.from("training_records").select("id"), "verify record count");
  if (total.length !== seedRecords.length) throw new Error(`Expected ${seedRecords.length} training records after restore, found ${total.length}.`);
  const now = await readSeedRecords(client);
  if (JSON.stringify(now) !== JSON.stringify(seedRecords)) throw new Error("Seed records were not restored.");
  rmSync(SNAPSHOT_FILE, { force: true });
}
