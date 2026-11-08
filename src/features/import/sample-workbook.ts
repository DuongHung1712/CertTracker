// Server-only in practice (xlsx writer): used by scripts/make-import-file.ts and tests.
import type { RecordStatus } from "@/components/status/labels";
import type { ExpiryStatus } from "@/components/status/expiry";
import { recordsToXlsx, type ExportRow } from "@/features/export/records-export";
import { isoToExcelSerial } from "@/features/import/clean";

export type CatalogueCourse = { name: string; validityMonths: number | null; provider: string; certType: string };

export type SamplePerson = {
  fullName: string;
  email: string;
  team: string;
  certificates: {
    course: string;
    status: RecordStatus;
    progress: number;
    plannedExamDate?: string;
    issuedDate?: string;
  }[];
};

const VALUES_START = "from (values";
const VALUES_END = ") as v(";
// A quoted string (with '' escapes), `null`, `true`/`false`, or a number; `::type` casts match nothing and are skipped.
const VALUE_TOKEN = /'((?:[^']|'')*)'|null|\d+(?:\.\d+)?|true|false/g;
const NAME_COLUMN = 0;
const CERT_TYPE_COLUMN = 1;
const PROVIDER_COLUMN = 2;
const VALIDITY_COLUMN = 4;

/** Reads the `from (values …)` rows of supabase/catalog/courses.sql: one row per line, a script writes that layout. */
export function readCatalogueSql(sql: string): CatalogueCourse[] {
  const markerAt = sql.indexOf(VALUES_START);
  if (markerAt === -1) throw new Error(`The catalogue SQL has no "${VALUES_START}" block`);
  const start = markerAt + VALUES_START.length;
  const block = sql.slice(start, sql.indexOf(VALUES_END, start));
  return block
    .split("\n")
    .filter((line) => line.trim().startsWith("("))
    .map((line) => {
      const values = [...line.matchAll(VALUE_TOKEN)].map((match) => (match[1] !== undefined ? match[1].replaceAll("''", "'") : match[0]));
      const validity = values[VALIDITY_COLUMN];
      return {
        name: values[NAME_COLUMN]!,
        validityMonths: validity === "null" ? null : Number(validity),
        provider: values[PROVIDER_COLUMN]!,
        certType: values[CERT_TYPE_COLUMN]!,
      };
    });
}

const MS_PER_DAY = 86_400_000;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** PostgreSQL `date + interval 'n months'`: the same day, or the month's last day when that month is shorter. */
function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string): number => isoToExcelSerial(to) - isoToExcelSerial(from);

const EXPIRING_SOON_DAYS = 30;
const EXPIRING_IN_60_DAYS = 60;

/** Same rule as SQL `public.expiry_status` (migration 20260928000003). */
function expiryStatus(issuedDate: string | null, validityMonths: number | null, today: string): ExpiryStatus {
  if (validityMonths === null) return "No Expiry";
  if (issuedDate === null) return "N/A";
  const days = daysBetween(today, addMonths(issuedDate, validityMonths));
  if (days < 0) return "Expired";
  if (days <= EXPIRING_SOON_DAYS) return "Expiring Soon";
  if (days <= EXPIRING_IN_60_DAYS) return "Expiring in 60d";
  return "Active";
}

export function buildSampleWorkbook(people: SamplePerson[], catalogue: CatalogueCourse[], today: string): Uint8Array {
  const rows = people.flatMap((person) =>
    person.certificates.map((certificate): ExportRow => {
      const course = catalogue.find((candidate) => candidate.name === certificate.course);
      if (!course) throw new Error(`Course not in the catalogue: ${certificate.course}`);
      const issuedDate = certificate.issuedDate ?? null;
      const expiryDate = issuedDate && course.validityMonths !== null ? addMonths(issuedDate, course.validityMonths) : null;
      return {
        id: `${person.email}/${course.name}`,
        memberId: person.email,
        memberCode: "",
        memberName: person.fullName,
        memberEmail: person.email,
        teamId: null,
        teamName: person.team,
        courseId: course.name,
        courseName: course.name,
        certTypeName: course.certType,
        providerName: course.provider,
        validityMonths: course.validityMonths,
        cost: null,
        costCurrency: null,
        estHours: null,
        status: certificate.status,
        progress: certificate.progress,
        plannedExamDate: certificate.plannedExamDate ?? null,
        issuedDate,
        certificateUrl: null,
        hasEvidence: false,
        viaCompany: false,
        refundStatus: "n_a",
        notes: null,
        expiryDate,
        daysToExpiry: expiryDate ? daysBetween(today, expiryDate) : null,
        expiryStatus: expiryStatus(issuedDate, course.validityMonths, today),
        careerRoleName: null,
        yoeYears: null,
      };
    }),
  );
  return recordsToXlsx(rows);
}

const REHEARSAL_TEAMS = ["Team Alpha", "Team Beta", "Team Gamma"];
const REHEARSAL_PEOPLE = 20;
const IN_PROGRESS_PERCENT = 50;
const PLANNED_EXAM_IN_DAYS = 30;
const NO_EXPIRY_ISSUED_DAYS_AGO = 90;

/** One certificate state per entry; `expiresInDays` counts from today (null: a course that never expires). The offsets sit well inside the 30 and 60 day bands. */
const SCENARIOS = [
  { status: "done", expiresInDays: 150 },
  { status: "done", expiresInDays: 20 },
  { status: "done", expiresInDays: 45 },
  { status: "done", expiresInDays: -40 },
  { status: "done", expiresInDays: null },
  { status: "in_progress" },
  { status: "not_started" },
] as const;

type Scenario = (typeof SCENARIOS)[number];

function rehearsalCertificate(scenario: Scenario, course: CatalogueCourse, today: string): SamplePerson["certificates"][number] {
  if (scenario.status === "not_started") return { course: course.name, status: "not_started", progress: 0 };
  if (scenario.status === "in_progress") {
    return { course: course.name, status: "in_progress", progress: IN_PROGRESS_PERCENT, plannedExamDate: addDays(today, PLANNED_EXAM_IN_DAYS) };
  }
  const issuedDate =
    scenario.expiresInDays === null || course.validityMonths === null
      ? addDays(today, -NO_EXPIRY_ISSUED_DAYS_AGO)
      : addDays(addMonths(today, -course.validityMonths), scenario.expiresInDays);
  return { course: course.name, status: "done", progress: 100, issuedDate };
}

/** 20 invented people over three teams, two certificates each, covering every state for `today`. Needs courses with and without validity. */
export function rehearsalPeople(today: string, catalogue: CatalogueCourse[]): SamplePerson[] {
  const expiring = catalogue.filter((course) => course.validityMonths !== null);
  const neverExpiring = catalogue.filter((course) => course.validityMonths === null);
  if (expiring.length < 2 || neverExpiring.length < 1) throw new Error("The catalogue needs two courses with validity and one without");

  return Array.from({ length: REHEARSAL_PEOPLE }, (_, i) => {
    const number = String(i + 1).padStart(2, "0");
    const certificates = [0, 1].map((slot) => {
      const scenario = SCENARIOS[(i + slot) % SCENARIOS.length]!;
      const pool = "expiresInDays" in scenario && scenario.expiresInDays === null ? neverExpiring : expiring;
      return rehearsalCertificate(scenario, pool[(i + slot) % pool.length]!, today);
    });
    return { fullName: `Rehearsal Person ${number}`, email: `person${number}@example.com`, team: REHEARSAL_TEAMS[i % REHEARSAL_TEAMS.length]!, certificates };
  });
}
