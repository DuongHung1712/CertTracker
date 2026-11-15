import { describe, expect, it } from "vitest";
import { similarMessage, commitDescription, countRows, findSimilar, hasNewEntities, listNewEntities, looseKey, rawCell, rowOutcome, rowsLabel } from "@/features/import/preview";
import type { ImportRowView } from "@/features/import/queries";

function row(overrides: Partial<ImportRowView> & { rowNo: number }): ImportRowView {
  return {
    id: `row-${overrides.rowNo}`,
    action: "skip",
    raw: { cells: {}, email: null, course: null },
    refs: null,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

const existingRefs = { member: { id: "m" }, course: { id: "c" } };

describe("rowOutcome", () => {
  it("treats any row with errors as an error, whatever its action", () => {
    expect(rowOutcome(row({ rowNo: 1, action: "skip", errors: ["x"] }))).toBe("error");
    expect(rowOutcome(row({ rowNo: 2, action: "create", errors: ["x"] }))).toBe("error");
  });

  it("maps the remaining actions", () => {
    expect(rowOutcome(row({ rowNo: 1, action: "create" }))).toBe("create");
    expect(rowOutcome(row({ rowNo: 2, action: "update" }))).toBe("update");
    expect(rowOutcome(row({ rowNo: 3, action: "skip" }))).toBe("unchanged");
  });
});

describe("countRows", () => {
  it("counts each outcome once", () => {
    const rows = [
      row({ rowNo: 1, action: "create" }),
      row({ rowNo: 2, action: "update" }),
      row({ rowNo: 3, action: "skip" }),
      row({ rowNo: 4, action: "skip", errors: ["x"] }),
    ];
    expect(countRows(rows)).toEqual({ create: 1, update: 1, unchanged: 1, error: 1 });
  });
});

const newCertificate = (name: string, provider: string, certType: string | null, member = { email: "ha@x.vn", fullName: "Hà" }) => ({
  member,
  course: { name, provider: { name: provider }, certType: certType === null ? null : { name: certType } },
});

describe("listNewEntities", () => {
  it("is empty when nothing new will be created", () => {
    expect(hasNewEntities(listNewEntities([row({ rowNo: 1, action: "create", refs: existingRefs })]))).toBe(false);
  });

  it("names each new entry once with the rows that need it, from create rows only", () => {
    const rows = [
      row({ rowNo: 2, action: "create", refs: newCertificate("Azure Fundamentals", "Microsoft", "Cloud") }),
      row({ rowNo: 3, action: "create", refs: newCertificate("  azure fundamentals", "microsoft", "cloud") }),
      row({ rowNo: 4, action: "create", refs: newCertificate("Google Cloud Digital Leader", "Google", null) }),
      // Not a create row: ignored even though it carries new names.
      row({ rowNo: 5, action: "update", refs: newCertificate("Ignored", "Ignored", "Ignored") }),
      row({ rowNo: 6, action: "skip", errors: ["x"], refs: null }),
    ];
    const entities = listNewEntities(rows);
    expect(entities.members).toEqual([{ name: "Hà", detail: "ha@x.vn", rows: [2, 3, 4], similarTo: null }]);
    expect(entities.providers.map((entry) => [entry.name, entry.rows])).toEqual([["Microsoft", [2, 3]], ["Google", [4]]]);
    expect(entities.certTypes.map((entry) => [entry.name, entry.rows])).toEqual([["Cloud", [2, 3]]]);
    expect(entities.certificates.map((entry) => [entry.name, entry.rows])).toEqual([["Azure Fundamentals", [2, 3]], ["Google Cloud Digital Leader", [4]]]);
    expect(entities.courses).toEqual([]);
  });

  it("does not list a catalog entry that already exists", () => {
    const entities = listNewEntities([
      row({ rowNo: 1, action: "create", refs: { member: { id: "m" }, course: { name: "New course", provider: { id: "p" }, certType: { id: "t" } } } }),
    ]);
    expect(entities.providers).toEqual([]);
    expect(entities.certTypes).toEqual([]);
    expect(entities.certificates.map((entry) => entry.name)).toEqual(["New course"]);
  });

  it("lists the course a priced new certificate brings", () => {
    const entities = listNewEntities([
      row({
        rowNo: 7,
        action: "create",
        refs: { member: { id: "m" }, course: { name: "Priced exam", provider: { id: "p" }, certType: null, cost: 150, costCurrency: "USD", estHours: null } },
      }),
    ]);
    expect(entities.courses).toEqual([{ name: "Priced exam", rows: [7], similarTo: null }]);
  });

  it("flags a new name that nearly duplicates an existing one, or another new one", () => {
    const rows = [
      row({ rowNo: 2, action: "create", refs: newCertificate("AWS Cloud Practitioner", "Comp TIA", "Cloud") }),
      row({ rowNo: 3, action: "create", refs: newCertificate("AWS-Cloud Practitioner", "CompTIA.", "Cloud") }),
      row({ rowNo: 4, action: "create", refs: newCertificate("Unrelated", "Fresh Provider", "Cloud") }),
    ];
    const entities = listNewEntities(rows, { providers: [{ id: "p1", name: "Comp-TIA" }], certTypes: ["Cloud"], certificates: [{ name: "AWS Cloud Practitioner ", provider: "AWS" }] });
    expect(entities.providers.map((entry) => [entry.name, entry.similarTo])).toEqual([
      ["Comp TIA", { name: "Comp-TIA", source: "existing" }],
      ["CompTIA.", { name: "Comp-TIA", source: "existing" }],
      ["Fresh Provider", null],
    ]);
    // The existing certificate is listed first, so it is the one named; an identical spelling ("Cloud" type) is never "similar".
    expect(entities.certificates.map((entry) => entry.similarTo)).toEqual([
      { name: "AWS Cloud Practitioner ", source: "existing" },
      { name: "AWS Cloud Practitioner ", source: "existing" },
      null,
    ]);
    expect(entities.certTypes.map((entry) => entry.similarTo)).toEqual([null]);
  });
});

describe("where a near-duplicate comes from", () => {
  const rows = [
    row({ rowNo: 2, action: "create", refs: newCertificate("Azure Basics", "Microsoft", "Cloud") }),
    row({ rowNo: 3, action: "create", refs: newCertificate("Azure-Basics", "Microsoft", "Cloud") }),
  ];

  it("names another new entry of the file as a file match, in the first entry's favour too", () => {
    const [first, second] = listNewEntities(rows).certificates;
    expect(first!.similarTo).toEqual({ name: "Azure-Basics", source: "file" });
    expect(second!.similarTo).toEqual({ name: "Azure Basics", source: "file" });
  });

  it("words each source apart; a file match never says it already exists", () => {
    expect(similarMessage({ name: "X", source: "existing" })).toContain("already exists");
    const file = similarMessage({ name: "X", source: "file" });
    expect(file).toContain("also new in this file");
    expect(file).not.toContain("already exists");
  });

  it("flags an identical certificate name under another provider, and a misspelt provider too", () => {
    const names = { providers: [{ id: "p1", name: "Microsoft" }], certTypes: [], certificates: [{ name: "Azure Basics", provider: "Microsoft" }] };
    const [entry] = listNewEntities([row({ rowNo: 2, action: "create", refs: newCertificate("Azure Basics", "Microsft", "Cloud") })], names).certificates;
    expect(entry!.similarTo).toEqual({ name: "Azure Basics", source: "provider", provider: "Microsoft" });
    expect(similarMessage(entry!.similarTo!)).toBe('"Azure Basics" exists under another provider "Microsoft". Check this is not a duplicate.');
  });

  it("does not flag the same name under the same provider (an existing provider keyed by id)", () => {
    const names = { providers: [{ id: "p1", name: "Microsoft" }], certTypes: [], certificates: [{ name: "Azure Basics", provider: "Microsoft" }] };
    const refs = { member: { id: "m" }, course: { name: "Azure Basics", provider: { id: "p1" }, certType: null } };
    expect(listNewEntities([row({ rowNo: 2, action: "create", refs })], names).certificates[0]!.similarTo).toBeNull();
  });
});

describe("findSimilar and looseKey", () => {
  it("ignores case, spacing, punctuation and accents, but not a different word", () => {
    expect(looseKey(" Comp-TIA ")).toBe("comptia");
    expect(findSimilar("AWS ", ["Aws"])).toBe("Aws");
    expect(findSimilar("Hà Nội", ["Ha Noi"])).toBe("Ha Noi");
    expect(findSimilar("AWS", ["Azure", "AWS"])).toBeNull();
    expect(findSimilar("---", ["..."])).toBeNull();
  });
});

describe("rowsLabel", () => {
  it("is singular for one row and shortens a long list", () => {
    expect(rowsLabel([3])).toBe("row 3");
    expect(rowsLabel([3, 5])).toBe("rows 3, 5");
    expect(rowsLabel([2, 3, 4, 5, 6, 7, 8])).toBe("rows 2, 3, 4, 5, 6 and 2 more");
  });
});

describe("rawCell", () => {
  it("finds a column by any of its aliases, whatever the file's header spelling", () => {
    const view = row({ rowNo: 2, raw: { cells: { Email: "a@x.vn", "Khóa học đã học": "Bootcamp", "Course studied ": "", Cost: 5 }, email: "a@x.vn", course: null } });
    expect(rawCell(view, "courseStudied")).toBe("Bootcamp");
    expect(rawCell(view, "cost")).toBe("5");
    expect(rawCell(view, "notes")).toBeNull();
  });
});

describe("commitDescription", () => {
  const counts = { create: 3, update: 2, unchanged: 0, error: 0 };

  it("states the all-or-nothing rule without mentioning errors when there are none", () => {
    expect(commitDescription(counts)).toBe("Creates 3 and updates 2. The import either completes in full or changes nothing.");
  });

  it("says rows with errors are left out and can be fixed and re-uploaded, apart from the all-or-nothing rule", () => {
    expect(commitDescription({ ...counts, error: 3 })).toBe(
      "Creates 3 and updates 2. 3 rows with errors are left out of this import: fix them in the file and upload it again. The import either completes in full or changes nothing.",
    );
    expect(commitDescription({ ...counts, error: 1 })).toContain("1 row with errors is left out of this import: fix it in the file");
  });
});
