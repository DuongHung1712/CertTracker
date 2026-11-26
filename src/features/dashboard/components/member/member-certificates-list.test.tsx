import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ExpiryTone } from "@/components/status/expiry";
import { doneRecord, makeRecord, noExpiryRecord } from "@/features/records/__fixtures__/record-row";
import type { RecordRow } from "@/features/records/queries";
import { MemberCertificatesList } from "./member-certificates-list";

// The sheet is closed in these tests; stub it so its server-action imports stay out of the render.
vi.mock("@/features/records/components/record-sheet", () => ({ RecordSheet: () => null }));

function render(records: RecordRow[]): string {
  return renderToStaticMarkup(
    <MemberCertificatesList
      fullName="Lê Minh Châu"
      records={records}
      certificateOptions={[]}
      memberId="m1"
      sheetOpen={false}
      onSheetOpenChange={() => {}}
      editingRecord={null}
      onEditRecord={() => {}}
    />,
  );
}

/**
 * Production hook (WP1): each row's icon tile carries `data-tone`. For a done record it is
 * `expiryMeta(toExpiryStatus(record.expiryStatus)).tone`; for an in-progress record "in-progress";
 * for a not-started record "neutral". Returns course name -> { tone, tile tag, markup up to the next tile }.
 */
function rowsByCourse(html: string): Map<string, { tone: string; tile: string; html: string }> {
  const rows = new Map<string, { tone: string; tile: string; html: string }>();
  const tiles = [...html.matchAll(/<[a-z]+[^>]*\bdata-tone="([^"]+)"[^>]*>/g)];
  tiles.forEach((m, i) => {
    const chunk = html.slice(m.index, tiles[i + 1]?.index);
    const course = /<h3[^>]*>([^<]+)<\/h3>/.exec(chunk)?.[1];
    if (course) rows.set(course, { tone: m[1], tile: m[0], html: chunk });
  });
  return rows;
}

const EXPIRY_TONES: readonly string[] = ["active", "expiring-60", "expiring-soon", "expired", "no-expiry", "na"];

// One row per real `expiry_status` value (SQL `expiry_status()`), plus study states.
const CASES: { record: RecordRow; tone: ExpiryTone | "in-progress" | "neutral"; label: string }[] = [
  { record: doneRecord(120, { id: "a", certificateName: "Course Active" }), tone: "active", label: "Valid" },
  { record: doneRecord(45, { id: "b", certificateName: "Course Sixty" }), tone: "expiring-60", label: "Expires in 31–60 days" },
  { record: doneRecord(12, { id: "c", certificateName: "Course Soon" }), tone: "expiring-soon", label: "Expires within 30 days" },
  { record: doneRecord(-5, { id: "d", certificateName: "Course Expired" }), tone: "expired", label: "Expired" },
  { record: noExpiryRecord({ id: "e", certificateName: "Course Forever" }), tone: "no-expiry", label: "No expiry" },
  {
    // A done row the view cannot date (no issued date). The DB CHECK normally prevents it; the UI must still not lie.
    record: makeRecord({ id: "f", certificateName: "Course Undated", issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
    tone: "na",
    label: "Not earned yet",
  },
  {
    record: makeRecord({ id: "g", certificateName: "Course Studying", status: "in_progress", progress: 40, issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
    tone: "in-progress",
    label: "In progress",
  },
  {
    record: makeRecord({ id: "h", certificateName: "Course Later", status: "not_started", progress: 0, issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
    tone: "neutral",
    label: "Not started",
  },
];

describe("[RED on 4a89dfd] MemberCertificatesList status tile (WP1: real expiry_status values)", () => {
  const rows = rowsByCourse(render(CASES.map((c) => c.record)));

  it("renders one tile per record", () => {
    expect(rows.size).toBe(CASES.length);
  });

  it.each(CASES)("$record.certificateName ($record.expiryStatus, $record.status) -> tone $tone, label $label", ({ record, tone, label }) => {
    const row = rows.get(record.certificateName);
    expect(row, `row for ${record.certificateName}`).toBeDefined();
    expect(row?.tone).toBe(tone);
    expect(row?.html).toContain(`>${label}<`);
    // The tile is coloured with the generated status utilities (globals.css has no --status-valid-*).
    if (EXPIRY_TONES.includes(tone)) expect(row?.tile).toContain(`bg-status-${tone}-bg`);
  });

  it("never gives a done, dated certificate the neutral tile", () => {
    for (const { record } of CASES.filter((c) => c.record.status === "done")) {
      expect(rows.get(record.certificateName)?.tone).not.toBe("neutral");
    }
  });

  it("treats an unknown status string as N/A instead of trusting it", () => {
    const odd: RecordRow = { ...makeRecord({ id: "z", certificateName: "Course Odd" }), expiryStatus: "valid" };
    const row = rowsByCourse(render([odd])).get("Course Odd");
    expect(row?.tone).toBe("na");
    expect(row?.html).toContain(">Not earned yet<");
  });
});

describe("Mark completed action", () => {
  it("is never offered: a certificate is a result, the journey is a learning item (decision #72)", () => {
    const html = render([
      makeRecord({ id: "r", certificateName: "Course Returned", status: "done", approval: "returned" }),
      doneRecord(120, { id: "d", certificateName: "Course Done" }),
    ]);
    expect(html).not.toContain("completed\"");
  });
});

describe("Delete draft action", () => {
  it("shows delete button for not_started, in_progress, and returned records, but not for waiting or approved", () => {
    const html = render([
      makeRecord({ id: "p", certificateName: "Course Studying", status: "in_progress" }),
      makeRecord({ id: "n", certificateName: "Course Planned", status: "not_started" }),
      makeRecord({ id: "r", certificateName: "Course Returned", status: "done", approval: "returned" }),
      makeRecord({ id: "w", certificateName: "Course Waiting", status: "done", approval: "waiting" }),
      doneRecord(120, { id: "a", certificateName: "Course Approved" }),
    ]);
    expect(html).toContain('aria-label="Delete Course Studying"');
    expect(html).toContain('aria-label="Delete Course Planned"');
    expect(html).toContain('aria-label="Delete Course Returned"');
    expect(html).not.toContain('aria-label="Delete Course Waiting"');
    expect(html).not.toContain('aria-label="Delete Course Approved"');
  });

  it("renders Pending Approval badge when a certificate is pending catalogue approval", () => {
    const html = render([
      makeRecord({ id: "p1", certificateName: "Proposed Course", certificateCatalogueStatus: "pending" }),
    ]);
    expect(html).toContain("Awaiting admin approval");
  });
});

describe("Credential Vault record line", () => {
  it("prints issued, valid-to and holder only on a held credential", () => {
    const held = render([doneRecord(200, { id: "held", issuedDate: "2025-03-12", expiryDate: "2028-03-12", memberCode: "M003" })]);
    expect(held).toContain("vault-credential-strip");
    expect(held).toContain("12/03/2025");
    expect(held).toContain("12/03/2028");
    expect(held).toContain("M003");
    expect(held).toContain('data-sealed="true"');

    const waiting = render([doneRecord(200, { id: "waiting", approval: "waiting" })]);
    expect(waiting).not.toContain("vault-credential-strip");
    expect(waiting).not.toContain("data-sealed");
  });
});
