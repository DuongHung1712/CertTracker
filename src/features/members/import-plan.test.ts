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

  it("allows an empty career role", () => {
    const [row] = plan([["Binh", "binh@certtracker.test", "Team Cloud", null]]).rows;
    expect(row).toMatchObject({ action: "create", careerRoleId: null, teamId: "t1" });
  });

  it("requires a team, but an existing email still skips", () => {
    const { rows } = plan([
      ["Binh", "binh@certtracker.test", null, null],
      ["An", "an@certtracker.test", null, null],
    ]);
    expect(rows[0]).toMatchObject({ action: "error", messages: ["Team is missing"] });
    expect(rows[1]?.action).toBe("skip");
  });

  it("flags every new row when the file has no Team column", () => {
    const result = planMemberImport([["Full name", "Email"], ["Binh", "binh@certtracker.test"]], lookups);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.rows[0]).toMatchObject({ action: "error", messages: ["Team is missing"] });
  });

  it("accepts Họ và tên as the Full name header", () => {
    const result = planMemberImport([["Họ và tên", "Email", "Team"], ["Binh", "binh@certtracker.test", "Team Cloud"]], lookups);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.rows[0]?.action).toBe("create");
  });

  it("refuses two columns with the same meaning", () => {
    const result = planMemberImport([["Name", "Full name", "Email", "Team"]], lookups);
    expect(result).toEqual({ ok: false, error: 'Column "Full name" means the same as another column. Delete or rename one of them.' });
  });

  it("reports row errors", () => {
    const { rows } = plan([
      [null, "a@certtracker.test", "Team Cloud", null],
      ["B", "not-an-email", "Team Cloud", null],
      ["C", "c@certtracker.test", "X", null],
      ["D", "d@certtracker.test", "Team Cloud", "Y"],
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
      ["Binh", "binh@certtracker.test", "Team Cloud"],
      [null, null, null, null],
      ["An", "an@certtracker.test"],
      [null, "bad"],
    ]);
    expect(rows).toHaveLength(3);
    expect(counts).toEqual({ create: 1, skip: 1, error: 1 });
  });

  it("skips an existing member whatever the other cells hold", () => {
    const [row] = plan([[null, "an@certtracker.test", "Nowhere", "Nobody"]]).rows;
    expect(row).toMatchObject({ action: "skip", messages: [] });
  });

  it("marks all three rows that share an email", () => {
    const { rows } = plan([
      ["A", "x@certtracker.test"],
      ["B", "x@certtracker.test"],
      ["C", "X@certtracker.test"],
    ]);
    expect(rows.map((r) => r.action)).toEqual(["error", "error", "error"]);
  });

  it("lets a duplicate win over skip for an existing email", () => {
    const { rows } = plan([
      ["A", "an@certtracker.test"],
      ["B", "an@certtracker.test"],
    ]);
    expect(rows.map((r) => r.action)).toEqual(["error", "error"]);
  });

  it("reads a number as team text and a boolean as a name", () => {
    const [row] = plan([[true, "n@certtracker.test", 5, null]]).rows;
    expect(row).toMatchObject({ fullName: "true", action: "error", messages: ['Team "5" does not exist'] });
  });

  describe("ambiguous names", () => {
    const run = (teams: { id: string; name: string }[], careerRoles: { id: string; name: string }[], team: string | null, role: string | null) => {
      const result = planMemberImport([HEADER, ["Z", "z@certtracker.test", team, role]], { memberEmails: [], teams, careerRoles });
      if (!result.ok) throw new Error(result.error);
      return result.value.rows[0]!;
    };

    it("errors when two teams share a name", () => {
      const row = run([{ id: "a", name: "Team Cloud" }, { id: "b", name: "Team Cloud" }], [], "Team Cloud", null);
      expect(row).toMatchObject({ action: "error", teamId: null, messages: ['Team "Team Cloud" matches more than one team'] });
    });

    it("prefers the exact name over a case variant", () => {
      const row = run([{ id: "a", name: "Team Cloud" }, { id: "b", name: "team cloud" }], [], "Team Cloud", null);
      expect(row).toMatchObject({ action: "create", teamId: "a" });
    });

    it("errors when two folded names match and none is exact", () => {
      const row = run([{ id: "a", name: "Team Hà" }, { id: "b", name: "Team Ha" }], [], "team ha", null);
      expect(row.messages).toEqual(['Team "team ha" matches more than one team']);
    });

    it("prefers the exact career role", () => {
      const row = run([{ id: "t", name: "T" }], [{ id: "a", name: "Developer" }, { id: "b", name: "developer" }], "T", "developer");
      expect(row).toMatchObject({ action: "create", careerRoleId: "b" });
    });

    it("errors on an ambiguous career role", () => {
      const row = run([{ id: "t", name: "T" }], [{ id: "a", name: "Developer" }, { id: "b", name: "developer" }], "T", "DEVELOPER");
      expect(row.messages).toEqual(['Career role "DEVELOPER" matches more than one career role']);
    });
  });
});
