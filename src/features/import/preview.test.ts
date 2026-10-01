import { describe, expect, it } from "vitest";
import { countRows, describeNewEntities, rowOutcome } from "@/features/import/preview";
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

describe("describeNewEntities", () => {
  it("returns null when nothing new will be created", () => {
    expect(describeNewEntities([row({ rowNo: 1, action: "create", refs: existingRefs })])).toBeNull();
  });

  it("lists new members, providers, cert types and courses once each, from create rows only", () => {
    const newCourse = (name: string, provider: string, certType: string | null) => ({
      member: { email: "ha@x.vn", fullName: "Hà" },
      course: { name, provider: { name: provider }, certType: certType === null ? null : { name: certType } },
    });
    const rows = [
      row({ rowNo: 1, action: "create", refs: newCourse("Azure Fundamentals", "Microsoft", "Cloud") }),
      row({ rowNo: 2, action: "create", refs: newCourse("  azure fundamentals", "microsoft", "cloud") }),
      row({ rowNo: 3, action: "create", refs: newCourse("Google Cloud Digital Leader", "Google", null) }),
      // Not a create row: ignored even though it carries new names.
      row({ rowNo: 4, action: "update", refs: newCourse("Ignored", "Ignored", "Ignored") }),
      row({ rowNo: 5, action: "skip", errors: ["x"], refs: null }),
    ];
    expect(describeNewEntities(rows)).toBe(
      "Sẽ tạo mới: 1 thành viên (Hà), 2 nhà cung cấp, 1 loại, 2 khóa học",
    );
  });

  it("does not count a catalog entry that already exists", () => {
    const rows = [
      row({
        rowNo: 1,
        action: "create",
        refs: { member: { id: "m" }, course: { name: "New course", provider: { id: "p" }, certType: { id: "t" } } },
      }),
    ];
    expect(describeNewEntities(rows)).toBe("Sẽ tạo mới: 1 khóa học");
  });

  it("truncates a long list of member names", () => {
    const rows = ["A", "B", "C", "D", "E"].map((name, i) =>
      row({ rowNo: i + 1, action: "create", refs: { member: { email: `${name}@x.vn`, fullName: name }, course: { id: "c" } } }),
    );
    expect(describeNewEntities(rows)).toBe("Sẽ tạo mới: 5 thành viên (A, B, C và 2 người khác)");
  });
});
