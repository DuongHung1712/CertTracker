import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "../../src/lib/assert-local-supabase-url";
import { todayVn } from "../../src/lib/dates";
import type { Database } from "../../src/types/database";
import { SEED_PASSWORD } from "../helpers";
import { readEnvFile } from "./env";

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
  | "certificate_id"
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

const RECORD_COLUMNS =
  "member_id, certificate_id, status, progress, planned_exam_date, issued_date, certificate_url, evidence_path, via_company, refund_status, notes";

const DAY_MS = 86_400_000;
const AN_ISSUED_DAYS_AGO = 1070;
const BINH_EXAM_IN_DAYS = 20;

const addDays = (iso: string, days: number): string => new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * The three seed records as `supabase/seed.sql` writes them, with its relative dates counted from today. Computed,
 * not captured, so the restore works on a database that has run before and never needs `db reset` (which breaks the
 * storage index locally).
 */
function seedRecords(today: string): SeedRecord[] {
  const untouched = { certificate_url: null, evidence_path: null, via_company: false, refund_status: "n_a", notes: null } as const;
  const [an, binh, chau] = SEED_MEMBER_IDS;
  const [saa, nvidia] = SEED_COURSE_IDS;
  const records: SeedRecord[] = [
    { member_id: an!, certificate_id: saa!, status: "done", progress: 100, issued_date: addDays(today, -AN_ISSUED_DAYS_AGO), planned_exam_date: null, ...untouched },
    { member_id: binh!, certificate_id: nvidia!, status: "in_progress", progress: 40, issued_date: null, planned_exam_date: addDays(today, BINH_EXAM_IN_DAYS), ...untouched },
    { member_id: chau!, certificate_id: saa!, status: "not_started", progress: 0, issued_date: null, planned_exam_date: null, ...untouched },
  ];
  return records.sort((x, y) => `${x.member_id}${x.certificate_id}`.localeCompare(`${y.member_id}${y.certificate_id}`));
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
  const certificates =
    providers.length === 0
      ? []
      : check(
          await client.from("certificates").select("id").in("provider_id", providers.map((provider) => provider.id)),
          "read imported certificates",
        );
  return {
    memberIds: members.map((member) => member.id),
    providerIds: providers.map((provider) => provider.id),
    courseIds: courses.map((course) => course.id),
    certificateIds: certificates.map((certificate) => certificate.id),
  };
}

async function readSeedRecords(client: Client): Promise<SeedRecord[]> {
  const rows = check(
    await client.from("training_records").select(RECORD_COLUMNS).in("member_id", SEED_MEMBER_IDS).in("certificate_id", SEED_COURSE_IDS),
    "read seed records",
  );
  return rows.sort((a, b) => `${a.member_id}${a.certificate_id}`.localeCompare(`${b.member_id}${b.certificate_id}`));
}

/** Call before the first import: puts the database in its seed state (a previous run may have crashed) and returns that state. */
export async function prepareSeedState(client: Client): Promise<SeedRecord[]> {
  const records = seedRecords(todayVn());
  await restoreSeed(client, records);
  return records;
}

/** Deletes what the import created and puts the seed records back. Idempotent; throws if anything is left behind. */
export async function restoreSeed(client: Client, seedRecords: SeedRecord[]): Promise<void> {
  // The spec only creates batches (rows cascade); the seed has none, so remove them all, including leftovers.
  check(await client.from("import_batches").delete().not("id", "is", null).select("id"), "delete import batches");

  const { memberIds, providerIds, courseIds, certificateIds } = await importedIds(client);
  if (memberIds.length > 0) {
    check(await client.from("training_records").delete().in("member_id", memberIds).select("id"), "delete imported member records");
  }
  if (certificateIds.length > 0) {
    check(await client.from("training_records").delete().in("certificate_id", certificateIds).select("id"), "delete imported certificate records");
  }
  if (courseIds.length > 0) check(await client.from("courses").delete().in("id", courseIds).select("id"), "delete imported courses");
  if (certificateIds.length > 0) check(await client.from("certificates").delete().in("id", certificateIds).select("id"), "delete imported certificates");
  if (providerIds.length > 0) check(await client.from("providers").delete().in("id", providerIds).select("id"), "delete imported providers");
  if (memberIds.length > 0) check(await client.from("members").delete().in("id", memberIds).select("id"), "delete imported member");

  // Seed records the import updated (An: issued date; Bình: progress, planned date, notes).
  for (const { member_id, certificate_id, ...seed } of seedRecords) {
    const updated = check(
      await client.from("training_records").update(seed).eq("member_id", member_id).eq("certificate_id", certificate_id).select("id"),
      "restore seed record",
    );
    if (updated.length !== 1) throw new Error(`Seed record ${member_id}|${certificate_id} not found (RLS refused the update?).`);
  }

  // RLS turns a forbidden delete into a silent no-op, so prove the result.
  const left = await importedIds(client);
  if (left.memberIds.length + left.providerIds.length + left.courseIds.length + left.certificateIds.length > 0) {
    throw new Error("restoreSeed left imported members/providers/courses behind (RLS refused a delete?).");
  }
  if (check(await client.from("import_batches").select("id"), "verify import batches").length > 0) {
    throw new Error("restoreSeed left import batches behind.");
  }
  const total = check(await client.from("training_records").select("id"), "verify record count");
  if (total.length !== seedRecords.length) throw new Error(`Expected ${seedRecords.length} training records after restore, found ${total.length}.`);
  const now = await readSeedRecords(client);
  if (!isDeepStrictEqual(now, seedRecords)) throw new Error("Seed records were not restored.");
}
