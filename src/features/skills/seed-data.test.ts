import { describe, expect, it } from "vitest";
import { DC34_MATRIX } from "./dc34-matrix";
import { DC34_SAME_AS, DC34_SKIPPED_DUPLICATES, ENTERPRISE_SKILL_CATALOG, skillNameKey } from "./seed-data";

describe("skills catalogue seed", () => {
  it("has no two skills with the same name (ignoring case and spaces)", () => {
    const keys = ENTERPRISE_SKILL_CATALOG.map((s) => skillNameKey(s.name));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("adds every DC34 skill except the skipped duplicates", () => {
    const dc34 = ENTERPRISE_SKILL_CATALOG.filter((s) => s.id.startsWith("dc34-"));
    expect(dc34.length + DC34_SKIPPED_DUPLICATES.length).toBe(DC34_MATRIX.length);
  });

  it("keeps the existing entry when a name repeats", () => {
    expect(skillNameKey(" Spring  Boot ")).toBe(skillNameKey("spring boot"));
  });

  it("merges near-duplicates into skills that exist", () => {
    const names = new Set(ENTERPRISE_SKILL_CATALOG.map((s) => s.name));
    const matrixNames = new Set(DC34_MATRIX.map((e) => e.name));
    for (const [dc34Name, existing] of Object.entries(DC34_SAME_AS)) {
      expect(matrixNames.has(dc34Name), dc34Name).toBe(true);
      expect(names.has(existing), existing).toBe(true);
      expect(names.has(dc34Name), dc34Name).toBe(false);
    }
  });
});
