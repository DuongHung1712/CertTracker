import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expiryMeta, type ExpiryStatus } from "@/components/status/expiry";
import { EXPORT_COLUMNS } from "@/features/export/records-export";
import { buildImportPlan, type ImportLookups, type ImportPlan } from "@/features/import/plan";
import {
  buildSampleWorkbook,
  readCatalogueSql,
  rehearsalPeople,
  type CatalogueCourse,
  type SamplePerson,
} from "@/features/import/sample-workbook";
import { readImportTable } from "@/features/import/workbook";
import { excelSerialToDate, type ImportTable } from "@/features/import/clean";

const TODAY = "2026-11-09";
const TEAMS = ["Team Alpha", "Team Beta", "Team Gamma"];
const PERSON_COUNT = 20;
const MS_PER_DAY = 86_400_000;

const CATALOGUE: CatalogueCourse[] = [
  { name: "Cloud Basics", validityMonths: 36, provider: "Example Cloud", certType: "Cloud" },
  { name: "Cloud Architect", validityMonths: 24, provider: "Example Cloud", certType: "Cloud" },
  { name: "Secure Coding", validityMonths: 12, provider: "Example Security", certType: "Security" },
  { name: "Scrum Basics", validityMonths: null, provider: "Example Agile", certType: "Agile & Project Management" },
  { name: "Language Level 3", validityMonths: null, provider: "Example Language", certType: "Languages & Soft Skills" },
];

/** The database's view of the catalogue: the three teams, no members, every catalogue course with its provider and type. */
function lookupsFor(catalogue: CatalogueCourse[]): ImportLookups {
  const providers = [...new Set(catalogue.map((c) => c.provider))].map((name, i) => ({ id: `provider-${i}`, name }));
  const certTypes = [...new Set(catalogue.map((c) => c.certType))].map((name, i) => ({ id: `cert-type-${i}`, name }));
  return {
    members: [],
    teams: TEAMS.map((name, i) => ({ id: `team-${i}`, name })),
    providers,
    certTypes,
    courses: catalogue.map((c, i) => ({
      id: `course-${i}`,
      name: c.name,
      providerId: providers.find((p) => p.name === c.provider)!.id,
      certTypeId: certTypes.find((t) => t.name === c.certType)!.id,
      validityMonths: c.validityMonths,
      cost: null,
      costCurrency: null,
      estHours: null,
    })),
    records: [],
  };
}

function readTable(bytes: Uint8Array): ImportTable {
  const result = readImportTable(bytes);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** Mirrors public.expiry_status (migration 20260928000003): PostgreSQL month arithmetic clamps to the month's last day. */
function expiryStatusOn(issuedDate: string | null, validityMonths: number | null, today: string): ExpiryStatus {
  if (validityMonths === null) return "No Expiry";
  if (issuedDate === null) return "N/A";
  const [year, month, day] = issuedDate.split("-").map(Number) as [number, number, number];
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month - 1 + validityMonths + 1, 0)).getUTCDate();
  const expiry = Date.UTC(year, month - 1 + validityMonths, Math.min(day, lastDayOfTargetMonth));
  const days = (expiry - Date.parse(`${today}T00:00:00Z`)) / MS_PER_DAY;
  if (days < 0) return "Expired";
  if (days <= 30) return "Expiring Soon";
  if (days <= 60) return "Expiring in 60d";
  return "Active";
}

type RehearsalState = "valid" | "expiring within 60 days" | "expired" | "no expiry" | "in progress" | "not started";

const STATE_OF_EXPIRY: Record<ExpiryStatus, RehearsalState | null> = {
  Active: "valid",
  "Expiring Soon": "expiring within 60 days",
  "Expiring in 60d": "expiring within 60 days",
  Expired: "expired",
  "No Expiry": "no expiry",
  "N/A": null,
};

function rehearsalState(row: ImportPlan["rows"][number], lookups: ImportLookups): RehearsalState | null {
  const { course, record } = row.normalized!;
  if (record.status === "in_progress") return "in progress";
  if (record.status === "not_started") return "not started";
  const validityMonths = "id" in course ? lookups.courses.find((c) => c.id === course.id)!.validityMonths : null;
  return STATE_OF_EXPIRY[expiryStatusOn(record.issuedDate, validityMonths, TODAY)];
}

function rehearsal() {
  const lookups = lookupsFor(CATALOGUE);
  const table = readTable(buildSampleWorkbook(rehearsalPeople(TODAY, CATALOGUE), CATALOGUE, TODAY));
  return { lookups, table, plan: buildImportPlan(table, lookups, TODAY) };
}

const EXPECTED_EMAILS = Array.from({ length: PERSON_COUNT }, (_, i) => `person${String(i + 1).padStart(2, "0")}@example.com`);

describe("the rehearsal workbook imports cleanly", () => {
  it("holds exactly person01@example.com to person20@example.com", () => {
    const { plan } = rehearsal();
    const emails = new Set(plan.rows.map((row) => row.raw.email));
    expect([...emails].sort()).toEqual(EXPECTED_EMAILS);
  });

  it("plans every row without errors or warnings", () => {
    const { plan } = rehearsal();
    expect(plan.rows.length).toBeGreaterThanOrEqual(PERSON_COUNT);
    expect(plan.rows.filter((row) => row.errors.length > 0)).toEqual([]);
    expect(plan.rows.filter((row) => row.warnings.length > 0)).toEqual([]);
  });

  it("creates every row, as new members on existing catalogue courses", () => {
    const { plan } = rehearsal();
    expect(plan.rows.every((row) => row.action === "create")).toBe(true);
    expect(plan.newEntities.members).toHaveLength(PERSON_COUNT);
    expect(plan.newEntities).toMatchObject({ providers: [], certTypes: [], courses: [] });
  });

  it("spreads the people over all three teams", () => {
    const { plan, lookups } = rehearsal();
    const teamIds = new Set(plan.rows.map((row) => {
      const member = row.normalized!.member;
      return "teamId" in member ? member.teamId : null;
    }));
    expect([...teamIds].sort()).toEqual(lookups.teams.map((team) => team.id));
  });

  it("covers every expiry state at least once, judged by the database's rule for that day", () => {
    const { plan, lookups } = rehearsal();
    const states = new Set(plan.rows.map((row) => rehearsalState(row, lookups)));
    for (const state of ["valid", "expiring within 60 days", "expired", "no expiry", "in progress", "not started"]) {
      expect(states, state).toContain(state);
    }
  });

  it("writes an Expiry status column that agrees with the database's rule", () => {
    const { plan, table, lookups } = rehearsal();
    const column = table.headers.indexOf("Expiry status");
    const written = table.rows.map((row) => row.cells[column]);
    const expected = plan.rows.map(({ normalized }) => {
      const { course, record } = normalized!;
      const validityMonths = "id" in course ? lookups.courses.find((c) => c.id === course.id)!.validityMonths : null;
      return expiryMeta(expiryStatusOn(record.issuedDate, validityMonths, TODAY)).label;
    });
    expect(written).toEqual(expected);
  });
});

describe("buildSampleWorkbook", () => {
  const person = (overrides: Partial<SamplePerson>): SamplePerson => ({
    fullName: "Sample Person",
    email: "sample@example.com",
    team: "Team Alpha",
    certificates: [{ course: "Cloud Basics", status: "not_started", progress: 0 }],
    ...overrides,
  });

  it("writes the export's headers, in order, on the first row", () => {
    const table = readTable(buildSampleWorkbook([person({})], CATALOGUE, TODAY));
    expect(table.headerRowNumber).toBe(1);
    expect(table.headers).toEqual(EXPORT_COLUMNS.map((c) => c.header));
  });

  it("passes a bad e-mail through, so the import reports it", () => {
    const table = readTable(buildSampleWorkbook([person({ email: "not-an-email" })], CATALOGUE, TODAY));
    const plan = buildImportPlan(table, lookupsFor(CATALOGUE), TODAY);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]!.errors).toContainEqual(expect.stringMatching(/not-an-email/));
  });

  it("clamps the expiry date to the month's last day, as PostgreSQL does", () => {
    const leapDay = person({ certificates: [{ course: "Secure Coding", status: "done", progress: 100, issuedDate: "2024-02-29" }] });
    const table = readTable(buildSampleWorkbook([leapDay], CATALOGUE, TODAY));
    const expiry = table.rows[0]!.cells[table.headers.indexOf("Expiry date")];
    expect(excelSerialToDate(Number(expiry))).toBe("2025-02-28");
  });

  it("refuses a certificate whose course is not in the catalogue, naming the course", () => {
    const unknown = person({ certificates: [{ course: "Unknown Course", status: "not_started", progress: 0 }] });
    expect(() => buildSampleWorkbook([unknown], CATALOGUE, TODAY)).toThrow(/Unknown Course/);
  });
});

describe("readCatalogueSql", () => {
  // The real file's layout: other inserts come first, the first row carries casts, parentheses appear inside quotes.
  const SNIPPET = `insert into public.cert_types (name) values
  ('Cloud'),
  ('Languages & Soft Skills')
on conflict (name) do nothing;

insert into public.courses (name, cert_type_id, provider_id, level, validity_months, refundable, cost, cost_currency, url)
select v.name, ct.id, p.id, v.level, v.validity_months, v.refundable, v.cost, v.cost_currency, v.url
from (values
  ('Cloud Basics (CB-100)', 'Cloud', 'Example Cloud', 'Associate'::text, 36::int, true, 150::numeric, 'USD'::text, 'https://example.com/cb-100'),
  ('Cloud Starter', 'Cloud', 'Example Cloud', null, null, true, null, null, 'https://example.com/starter'),
  ('Language Level 3', 'Languages & Soft Skills', 'Example Testing Centre (ETC)', 'Level 3', 24, true, null, null, 'https://example.com/l3')
) as v(name, cert_type, provider, level, validity_months, refundable, cost, cost_currency, url)
join public.cert_types ct on ct.name = v.cert_type
join public.providers p on p.name = v.provider
on conflict (provider_id, name) do nothing;
`;

  it("reads name, validity, provider and type from each values row, and nothing else", () => {
    expect(readCatalogueSql(SNIPPET)).toEqual([
      { name: "Cloud Basics (CB-100)", validityMonths: 36, provider: "Example Cloud", certType: "Cloud" },
      { name: "Cloud Starter", validityMonths: null, provider: "Example Cloud", certType: "Cloud" },
      { name: "Language Level 3", validityMonths: 24, provider: "Example Testing Centre (ETC)", certType: "Languages & Soft Skills" },
    ]);
  });

  it("refuses input without the from (values marker instead of reading the wrong block", () => {
    expect(() => readCatalogueSql("insert into public.cert_types (name) values\n  ('Cloud');\n")).toThrow();
  });

  describe("on the real catalogue file", () => {
    const courses = readCatalogueSql(readFileSync("supabase/catalog/courses.sql", "utf8"));

    it("reads the first three rows as written", () => {
      expect(courses.slice(0, 3)).toEqual([
        { name: "AWS Certified Solutions Architect - Associate", validityMonths: 36, provider: "AWS", certType: "Cloud" },
        { name: "AWS Certified Cloud Practitioner", validityMonths: 36, provider: "AWS", certType: "Cloud" },
        { name: "AWS Certified Developer - Associate", validityMonths: 36, provider: "AWS", certType: "Cloud" },
      ]);
    });

    it("reads a course without validity as null", () => {
      expect(courses.find((c) => c.name === "Microsoft Certified: Azure Fundamentals (AZ-900)")?.validityMonths).toBeNull();
    });

    it("reads all 55 courses", () => {
      expect(courses).toHaveLength(55);
    });
  });
});
