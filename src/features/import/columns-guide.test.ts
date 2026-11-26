import { describe, expect, it } from "vitest";
import { HEADER_ALIASES, IMPORT_FIELDS, mapHeaders } from "@/features/import/clean";
import { EXAM_ONLY_NOTE, GUIDE_COLUMNS } from "@/features/import/columns-guide";

describe("columns guide", () => {
  it("covers every import field once, with the two required columns first", () => {
    expect(GUIDE_COLUMNS.map((column) => column.field).sort()).toEqual([...IMPORT_FIELDS].sort());
    expect(GUIDE_COLUMNS.filter((column) => column.required).map((column) => column.field)).toEqual(["email", "courseName"]);
    expect(GUIDE_COLUMNS.slice(0, 2).every((column) => column.required)).toBe(true);
  });

  it("takes its aliases from the importer, and every header it shows is read by the importer", () => {
    for (const column of GUIDE_COLUMNS) {
      expect(column.aliases.every((alias) => HEADER_ALIASES[column.field].includes(alias))).toBe(true);
      expect(mapHeaders([column.header]).map[column.field]).toBe(0);
      for (const alias of column.aliases) expect(mapHeaders([alias]).map[column.field]).toBe(0);
    }
  });

  it("states that an import only creates exam certificates", () => {
    expect(EXAM_ONLY_NOTE).toBe("Every new certificate created by an import is an exam certificate. Add course certificates in the Catalogue.");
  });
});
