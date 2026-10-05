import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIR = resolve(ROOT, "docs/process");
const read = (name: string) => readFileSync(resolve(DIR, name), "utf8");

type Table = { header: string[]; rows: string[][] };

const splitRow = (line: string) =>
  line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());

/** The first Markdown table whose header starts with `firstHeader`: its header cells and data rows. */
function readTable(markdown: string, firstHeader: string): Table {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`| ${firstHeader} |`));
  if (start < 0) throw new Error(`table starting with "${firstHeader}" not found`);
  const rows: string[][] = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith("|"); i += 1) {
    rows.push(splitRow(lines[i]));
  }
  return { header: splitRow(lines[start]), rows };
}

type Requirement = {
  id: string;
  source: string;
  priority: string;
  build: string;
  evidence: string;
  validation: string;
};

type WorkPackage = {
  code: string;
  depends: string;
  status: string;
  requirements: string;
};

const REQUIREMENT_HEADER = ["ID", "Requirement", "Source", "Priority", "Build status", "Evidence", "Validation"];
const WBS_HEADER = [
  "WBS",
  "Work package",
  "Deliverable",
  "Acceptance",
  "Planned",
  "Actual",
  "Est. remaining",
  "Depends on",
  "Status",
  "Requirements",
];

const requirementsTable = readTable(read("01-requirements-and-ca.md"), "ID");
const wbsTable = readTable(read("02-wbs.md"), "WBS");

const requirements: Requirement[] = requirementsTable.rows.map((r) => ({
  id: r[0],
  source: r[2],
  priority: r[3],
  build: r[4],
  evidence: r[5],
  validation: r[6],
}));

const wbs: WorkPackage[] = wbsTable.rows.map((r) => ({
  code: r[0],
  depends: r[7],
  status: r[8],
  requirements: r[9],
}));

const SOURCE = /^(FL-[1-9]|SPEC §\S+|DEC #\d+|MGR|PROJECT)$/;
const PRIORITY = new Set(["Must", "Should", "Could"]);
const BUILD = /^(Built \(W[1-6]\)|Built \(W6, unmerged\)|Partial|Planned|Gated \(G1\))$/;
const VALIDATION = new Set(["Assumed", "Decided", "Validated"]);
const WBS_STATUS = new Set(["Done", "In progress", "Not started", "Blocked (G1)"]);

describe("01-requirements-and-ca.md", () => {
  it("keeps the documented columns and well-formed rows", () => {
    expect(requirementsTable.header).toEqual(REQUIREMENT_HEADER);
    for (const row of requirementsTable.rows) {
      expect(row.length, `row "${row[0]}" has ${row.length} cells, expected ${REQUIREMENT_HEADER.length}`).toBe(
        REQUIREMENT_HEADER.length,
      );
      expect(row[0], `malformed requirement id "${row[0]}"`).toMatch(/^(R|NFR)-\d+$/);
    }
  });

  it("has requirements and unique ids", () => {
    expect(requirements.length).toBeGreaterThan(20);
    const ids = requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(requirements.map((r) => [r.id, r] as const))("%s uses only allowed vocabulary", (id, r) => {
    expect(r.source, `${id} source`).toMatch(SOURCE);
    expect(PRIORITY.has(r.priority), `${id} priority "${r.priority}"`).toBe(true);
    expect(r.build, `${id} build status`).toMatch(BUILD);
    expect(VALIDATION.has(r.validation), `${id} validation "${r.validation}"`).toBe(true);
    // Only requirements that are not built yet may have no evidence.
    if (r.evidence === "—") {
      expect(r.build, `${id} has no evidence but claims to be built`).toMatch(/^(Planned|Gated \(G1\))$/);
    }
    // Anything that is not "Planned" or "Gated (G1)" must name its evidence (never blank).
    if (!/^(Planned|Gated \(G1\))$/.test(r.build)) {
      expect(r.evidence.length > 0 && r.evidence !== "—", `${id} is "${r.build}" but has empty evidence`).toBe(true);
    }
  });

  it("every piece of evidence points at something that exists on this branch unless it is flagged as unmerged", () => {
    for (const r of requirements) {
      if (r.evidence === "—" || r.build.includes("unmerged")) continue;
      for (const path of r.evidence.split(", ")) {
        expect(path.trim().length > 0, `${r.id}: empty evidence entry in "${r.evidence}"`).toBe(true);
        expect(existsSync(resolve(ROOT, path)), `${r.id}: ${path} does not exist`).toBe(true);
      }
    }
  });

  it("no requirement claims to be Validated without a recorded interview (none have been done yet)", () => {
    expect(
      requirements.filter((r) => r.validation === "Validated").map((r) => r.id),
      "No user interviews have been recorded yet, so nothing may be marked Validated. " +
        "When interviews happen, record them in 01 section 7 and then relax this check deliberately.",
    ).toEqual([]);
  });
});

describe("02-wbs.md", () => {
  it("keeps the documented columns and well-formed rows", () => {
    expect(wbsTable.header).toEqual(WBS_HEADER);
    for (const row of wbsTable.rows) {
      expect(row.length, `row "${row[0]}" has ${row.length} cells, expected ${WBS_HEADER.length}`).toBe(WBS_HEADER.length);
    }
  });

  it("has the gate and valid statuses", () => {
    const gate = wbs.find((r) => r.code === "G1");
    expect(gate, "work package G1 is missing").toBeDefined();
    expect(gate?.status).toBe("Not started");
    for (const r of wbs) expect(WBS_STATUS.has(r.status), `${r.code} status "${r.status}"`).toBe(true);
  });

  it("has unique work-package codes", () => {
    const codes = wbs.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("traces both ways: every requirement is in a work package and every referenced id exists", () => {
    const known = new Set(requirements.map((r) => r.id));
    const referenced = new Set<string>();
    for (const row of wbs) {
      if (row.requirements === "—") continue;
      for (const id of row.requirements.split(", ")) {
        expect(known.has(id), `WBS ${row.code} references unknown ${id}`).toBe(true);
        referenced.add(id);
      }
    }
    const missing = [...known].filter((id) => !referenced.has(id));
    expect(missing, `requirements not covered by any work package: ${missing.join(", ")}`).toEqual([]);
  });

  it("blocks Phase 2 behind gate G1", () => {
    const phase2 = wbs.find((r) => r.code === "10");
    expect(phase2?.status).toBe("Blocked (G1)");
    expect(phase2?.depends).toContain("G1");
  });
});

describe("process documents", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));

  it("contains the expected files", () => {
    expect(files).toEqual(
      expect.arrayContaining(["README.md", "00-process-status.md", "01-requirements-and-ca.md", "02-wbs.md", "03-sad.md"]),
    );
  });

  it("README.md links every numbered document", () => {
    const readme = read("README.md");
    for (const name of ["00-process-status.md", "01-requirements-and-ca.md", "02-wbs.md", "03-sad.md"]) {
      expect(readme, `README.md does not link ${name}`).toContain(`](${name})`);
    }
  });

  it.each(files)("%s: relative links resolve and has a Vietnamese summary", (file) => {
    const text = read(file);
    for (const [, target] of text.matchAll(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g)) {
      const path = target.split("#")[0];
      if (!path) continue;
      expect(existsSync(resolve(dirname(resolve(DIR, file)), path)), `${file} → ${target}`).toBe(true);
    }
    if (file !== "README.md") expect(text).toContain("**Tóm tắt (VI):**");
  });

  it("03-sad.md has the three mermaid diagrams (context, container, data model)", () => {
    const sad = read("03-sad.md");
    expect((sad.match(/```mermaid/g) ?? []).length).toBe(3);
  });
});
