import { describe, expect, it } from "vitest";
import type { Cell } from "@/features/import/clean";
import { planMemberImport } from "./import-plan";

const HEADER: Cell[] = ["Full name", "Email", "Team", "Career role"];
const lookups = {
  memberEmails: ["an@certtracker.test"],
  teams: [{ id: "t1", name: "Team Cloud" }],
  careerRoles: [{ id: "r1", name: "Developer" }],
};

function plan(rows: Cell[][]) {
  const result = planMemberImport([HEADER, ...rows], lookups);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("planMemberImport", () => {
  it("creates a valid row and matches the team case-insensitively", () => {
    const [row] = plan([["Binh", "binh@certtracker.test", "team cloud", "developer"]]).rows;
    expect(row).toMatchObject({ line: 2, action: "create", teamId: "t1", careerRoleId: "r1", messages: [] });
  });

  it("skips an email that already exists, ignoring case and spaces", () => {
    const [row] = plan([["An", " AN@CertTracker.test ", null, null]]).rows;
    expect(row?.action).toBe("skip");
  });

  it("allows an empty career role and team", () => {
    const [row] = plan([["Binh", "binh@certtracker.test", null, null]]).rows;
    expect(row).toMatchObject({ action: "create", careerRoleId: null, teamId: null });
  });

  it("reports row errors", () => {
    const { rows } = plan([
      [null, "a@certtracker.test", null, null],
      ["B", "not-an-email", null, null],
      ["C", "c@certtracker.test", "X", null],
      ["D", "d@certtracker.test", null, "Y"],
    ]);
    expect(rows.map((r) => r.action)).toEqual(["error", "error", "error", "error"]);
    expect(rows[0]?.messages).toContain("Full name is missing");
    expect(rows[1]?.messages[0]).toContain("not valid");
    expect(rows[2]?.messages).toContain('Team "X" does not exist');
    expect(rows[3]?.messages).toContain('Career role "Y" does not exist');
  });

  it("marks both rows of a duplicate email, including case-only duplicates", () => {
    const { rows } = plan([
      ["E", "e@certtracker.test", null, null],
      ["F", "E@CertTracker.test", null, null],
    ]);
    for (const row of rows) {
      expect(row.action).toBe("error");
      expect(row.messages).toContain("This email appears more than once in the file");
    }
  });

  it("finds the header below a title row", () => {
    const result = planMemberImport([["Members"], [], HEADER, ["Binh", "binh@certtracker.test"]], lookups);
    expect(result.ok && result.value.rows[0]?.line).toBe(4);
  });

  it("rejects a file without Full name and Email columns", () => {
    expect(planMemberImport([["Full name", "Team"]], lookups)).toEqual({
      ok: false,
      error: "The file needs the columns Full name and Email.",
    });
  });

  it("rejects more than 500 data rows", () => {
    const rows = Array.from({ length: 501 }, (_, i): Cell[] => [`M${i}`, `m${i}@certtracker.test`]);
    expect(planMemberImport([HEADER, ...rows], lookups)).toEqual({
      ok: false,
      error: "The file has more than 500 rows. Split it and import it in parts.",
    });
  });

  it("counts every data row and ignores blank lines", () => {
    const { rows, counts } = plan([
      ["Binh", "binh@certtracker.test"],
      [null, null, null, null],
      ["An", "an@certtracker.test"],
      [null, "bad"],
    ]);
    expect(rows).toHaveLength(3);
    expect(counts).toEqual({ create: 1, skip: 1, error: 1 });
  });
});
