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

/** The data rows of the Markdown table whose header line is `lines[start]`. */
function tableAt(lines: string[], start: number): Table {
  const rows: string[][] = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith("|"); i += 1) {
    rows.push(splitRow(lines[i]));
  }
  return { header: splitRow(lines[start]), rows };
}

/** The first Markdown table whose header starts with `firstHeader`: its header cells and data rows. */
function readTable(markdown: string, firstHeader: string): Table {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`| ${firstHeader} |`));
  if (start < 0) throw new Error(`table starting with "${firstHeader}" not found`);
  return tableAt(lines, start);
}

/** The first Markdown table whose header cells are exactly `header`. */
function readTableWithHeader(markdown: string, header: readonly string[]): Table {
  const lines = markdown.split(/\r?\n/);
  const start = lines.indexOf(`| ${header.join(" | ")} |`);
  if (start < 0) throw new Error(`table with header "${header.join(" | ")}" not found`);
  return tableAt(lines, start);
}

type Requirement = {
  id: string;
  need: string;
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

const NUMBERED_DOCS = [
  "00-process-status.md",
  "01-idea-and-brainstorm.md",
  "02-concept-analysis.md",
  "03-requirements.md",
  "04-wbs.md",
  "05-sad.md",
  "06-design-and-mockups.md",
  "07-poc-and-mvp.md",
  "08-production-readiness.md",
] as const;

const REQUIREMENT_HEADER = ["ID", "Requirement", "Need", "Source", "Priority", "Build status", "Evidence", "Validation"];
const NEEDS_HEADER = ["ID", "Need (as a user outcome)", "Who", "Evidence today", "Linked assumptions", "Status"] as const;
const ASSUMPTIONS_HEADER = ["ID", "Assumption", "How to validate", "Who", "Status"] as const;
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

const conceptDoc = read("02-concept-analysis.md");
const requirementsDoc = read("03-requirements.md");
// The requirements table is the first table in 03 whose header starts with "ID".
const requirementsTable = readTable(requirementsDoc, "ID");
const needsTable = readTableWithHeader(conceptDoc, NEEDS_HEADER);
const assumptionsTable = readTableWithHeader(conceptDoc, ASSUMPTIONS_HEADER);
const wbsTable = readTable(read("04-wbs.md"), "WBS");

const requirements: Requirement[] = requirementsTable.rows.map((r) => ({
  id: r[0],
  need: r[2],
  source: r[3],
  priority: r[4],
  build: r[5],
  evidence: r[6],
  validation: r[7],
}));

const wbs: WorkPackage[] = wbsTable.rows.map((r) => ({
  code: r[0],
  depends: r[7],
  status: r[8],
  requirements: r[9],
}));

const matches = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1]);

const knownNeeds = new Set(needsTable.rows.map((r) => r[0]));
// Assumptions (02 §11) and success criteria (02 §10) are the first cell of their table rows in 02.
const assumptionAndCriterionRows = matches(conceptDoc, /^\| (A-\d+|SM-\d+) \|/gm);
const knownAssumptionsAndCriteria = new Set(assumptionAndCriterionRows);

const SOURCE = /^(FL-[1-9]|SPEC §\S+|DEC #\d+|MGR|PROJECT)$/;
const PRIORITY = new Set(["Must", "Should", "Could"]);
const BUILD = /^(Built \(W[1-6]\)|Built \(W6, unmerged\)|Partial|Planned|Gated \(G1\))$/;
const VALIDATION = new Set(["Assumed", "Decided", "Validated"]);
// The status vocabulary defined in 02 section 1. `Decided` is allowed for assumptions only (A-05).
const NEED_STATUS = new Set(["Assumed", "Partly evidenced", "Validated", "Contradicted"]);
const ASSUMPTION_STATUS = new Set([...NEED_STATUS, "Decided"]);
const NOT_VALIDATED_YET =
  "No interview result has been recorded yet, so nothing may be marked Validated. " +
  "Relax this check deliberately when the first interview result is recorded (02 Appendix A.3).";
const WBS_STATUS = new Set(["Done", "In progress", "Not started", "Blocked (G1)"]);

describe("02-concept-analysis.md", () => {
  it("keeps the documented columns in the needs table, with well-formed unique ids", () => {
    expect(needsTable.header).toEqual([...NEEDS_HEADER]);
    expect(needsTable.rows.length).toBeGreaterThan(5);
    for (const row of needsTable.rows) {
      expect(row.length, `row "${row[0]}" has ${row.length} cells, expected ${NEEDS_HEADER.length}`).toBe(
        NEEDS_HEADER.length,
      );
      expect(row[0], `malformed need id "${row[0]}"`).toMatch(/^N-\d{2}$/);
    }
    const ids = needsTable.rows.map((r) => r[0]);
    expect(
      ids.filter((id, i) => ids.indexOf(id) !== i),
      "need ids are repeated",
    ).toEqual([]);
  });

  it("needs use only the status vocabulary of 02 section 1, and every linked assumption exists in 02", () => {
    const status = NEEDS_HEADER.indexOf("Status");
    const linked = NEEDS_HEADER.indexOf("Linked assumptions");
    for (const row of needsTable.rows) {
      expect(NEED_STATUS.has(row[status]), `${row[0]} status "${row[status]}"`).toBe(true);
      for (const id of row[linked].split(", ")) {
        expect(knownAssumptionsAndCriteria.has(id), `${row[0]} links unknown ${id}`).toBe(true);
      }
    }
  });

  it("assumptions keep their columns and use only the status vocabulary of 02 section 1", () => {
    expect(assumptionsTable.header).toEqual([...ASSUMPTIONS_HEADER]);
    expect(assumptionsTable.rows.length).toBeGreaterThan(10);
    const status = ASSUMPTIONS_HEADER.indexOf("Status");
    for (const row of assumptionsTable.rows) {
      expect(row.length, `row "${row[0]}" has ${row.length} cells, expected ${ASSUMPTIONS_HEADER.length}`).toBe(
        ASSUMPTIONS_HEADER.length,
      );
      expect(row[0], `malformed assumption id "${row[0]}"`).toMatch(/^A-\d{2}$/);
      expect(ASSUMPTION_STATUS.has(row[status]), `${row[0]} status "${row[status]}"`).toBe(true);
    }
  });

  it("no need and no assumption is Validated yet (no interview result is recorded)", () => {
    const needStatus = NEEDS_HEADER.indexOf("Status");
    const assumptionStatus = ASSUMPTIONS_HEADER.indexOf("Status");
    expect(
      needsTable.rows.filter((r) => r[needStatus] === "Validated").map((r) => r[0]),
      NOT_VALIDATED_YET,
    ).toEqual([]);
    expect(
      assumptionsTable.rows.filter((r) => r[assumptionStatus] === "Validated").map((r) => r[0]),
      NOT_VALIDATED_YET,
    ).toEqual([]);
  });

  it("numbers its assumption and success-criterion rows uniquely", () => {
    expect(assumptionAndCriterionRows.length).toBeGreaterThan(10);
    expect(
      assumptionAndCriterionRows.filter((id, i) => assumptionAndCriterionRows.indexOf(id) !== i),
      "assumption or success-criterion ids are repeated",
    ).toEqual([]);
  });
});

describe("03-requirements.md", () => {
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

  it("every Need cell is '—' or a list of needs from the needs table in 02", () => {
    for (const r of requirements) {
      if (r.need === "—") continue;
      for (const id of r.need.split(", ")) {
        expect(id, `${r.id}: malformed need "${id}"`).toMatch(/^N-\d{2}$/);
        expect(knownNeeds.has(id), `${r.id} cites ${id}, which is not in the needs table of 02`).toBe(true);
      }
    }
  });

  it("section 3 lists exactly the requirements whose Need is '—'", () => {
    const start = requirementsDoc.indexOf("## 3. Requirements without an identified need");
    expect(start, "section 3 is missing").toBeGreaterThan(0);
    const end = requirementsDoc.indexOf("\n## ", start + 1);
    const listed = matches(requirementsDoc.slice(start, end), /^- `((?:R|NFR)-\d+)`/gm);
    expect(listed).toEqual(requirements.filter((r) => r.need === "—").map((r) => r.id));
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
        "When interviews happen, record them with the kit in 02 Appendix A and then relax this check deliberately.",
    ).toEqual([]);
  });
});

describe("04-wbs.md", () => {
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

  it("contains exactly the numbered documents 00-08 and the README", () => {
    expect([...files].sort()).toEqual([...NUMBERED_DOCS, "README.md"]);
  });

  it("README.md links every numbered document, in process order", () => {
    const readme = read("README.md");
    const positions = NUMBERED_DOCS.map((name) => readme.indexOf(`](${name})`));
    for (const [i, name] of NUMBERED_DOCS.entries()) {
      expect(positions[i], `README.md does not link ${name}`).toBeGreaterThan(0);
    }
    expect(
      [...positions].sort((a, b) => a - b),
      "README.md lists the documents out of process order",
    ).toEqual(positions);
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

  it.each(files)("%s cites only needs, assumptions and success criteria that exist in 02", (file) => {
    const text = read(file);
    for (const id of matches(text, /\b(N-\d+)\b/g)) {
      expect(knownNeeds.has(id), `${file} cites ${id}, which is not in the needs table of 02`).toBe(true);
    }
    // `\b` keeps "NFR-01" from matching here; "A-xx" and "SM-x" placeholders have no digits.
    for (const id of matches(text, /\b((?:A|SM)-\d+)\b/g)) {
      expect(knownAssumptionsAndCriteria.has(id), `${file} cites ${id}, which is not defined in 02`).toBe(true);
    }
  });

  it("05-sad.md has the three mermaid diagrams (context, container, data model)", () => {
    const sad = read("05-sad.md");
    expect((sad.match(/```mermaid/g) ?? []).length).toBe(3);
  });
});

describe("06-design-and-mockups.md", () => {
  const design = read("06-design-and-mockups.md");
  const imagesDir = resolve(DIR, "images");
  const markdownFiles = readdirSync(DIR).filter((f) => f.endsWith(".md"));

  it("has the three user-flow diagrams (mermaid is for flows only; mockups are images)", () => {
    expect((design.match(/```mermaid/g) ?? []).length).toBe(3);
  });

  it("embeds its screenshots as images that exist (the link check above covers image links too)", () => {
    const embedded = [...design.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    expect(embedded.length).toBeGreaterThan(10);
    for (const target of embedded) {
      expect(target, `image link "${target}" must point into images/`).toMatch(/^images\/[\w-]+\.png$/);
      expect(existsSync(resolve(DIR, target)), `${target} does not exist`).toBe(true);
    }
  });

  it("has no orphan images: every .png in images/ is referenced by at least one document", () => {
    const text = markdownFiles.map(read).join("\n");
    const orphans = readdirSync(imagesDir)
      .filter((f) => f.endsWith(".png"))
      .filter((f) => !text.includes(`images/${f}`));
    expect(orphans, `images not referenced by any document: ${orphans.join(", ")}`).toEqual([]);
  });
});

describe("07-poc-and-mvp.md and 08-production-readiness.md", () => {
  const LATER_DOCS = ["07-poc-and-mvp.md", "08-production-readiness.md"] as const;

  const knownIds = new Set([...requirements.map((r) => r.id), ...knownAssumptionsAndCriteria]);
  const knownWbs = new Set(wbs.map((r) => r.code));

  /** Every row of `table` has as many cells as its header (a stray "|" in a cell shifts every later column). */
  const expectRectangular = (name: string, table: Table) => {
    expect(table.rows.length, `${name} has no rows`).toBeGreaterThan(0);
    for (const row of table.rows) {
      expect(row.length, `${name}: row "${row[0]}" has ${row.length} cells, expected ${table.header.length}`).toBe(
        table.header.length,
      );
    }
  };

  const findings = readTable(read("07-poc-and-mvp.md"), "#");
  const acceptance = readTable(read("07-poc-and-mvp.md"), "ID");
  const checklist = readTable(read("08-production-readiness.md"), "ID");

  it("the P- and MVP- tables in 07 and the PRD- table in 08 keep their columns on every row", () => {
    expect(findings.header).toEqual(["#", "Technical question", "Answer", "Evidence", "Limits"]);
    expect(acceptance.header).toEqual(["ID", "Criterion", "How it is checked", "Threshold", "Status"]);
    expect(checklist.header).toEqual(["ID", "Area", "Item", "Why", "Today", "Needed before", "Owner", "WBS"]);
    expectRectangular("07 findings", findings);
    expectRectangular("07 acceptance criteria", acceptance);
    expectRectangular("08 checklist", checklist);
  });

  it("08 says for every item whether it blocks the pilot (WBS 9.1) or production", () => {
    const when = checklist.header.indexOf("Needed before");
    const wbsColumn = checklist.header.indexOf("WBS");
    for (const row of checklist.rows) {
      expect(["Pilot", "Production"], `${row[0]} "${row[when]}"`).toContain(row[when]);
      if (row[when] === "Pilot") expect(row[wbsColumn], `${row[0]} is a pilot item outside 9.1`).toBe("9.1");
    }
  });

  it("no MVP acceptance criterion is claimed as met before a pilot has happened", () => {
    const status = acceptance.header.indexOf("Status");
    for (const row of acceptance.rows) expect(row[status], `${row[0]}`).toMatch(/^(Not met|Partly met) — /);
  });

  it.each(LATER_DOCS)("%s cites only requirement, assumption, success-criterion and WBS ids that exist", (file) => {
    const text = read(file);
    // `\b` keeps "NFR-01" from also matching as "R-01", and "PRD-01" / "MVP-01" from matching anything here.
    const ids = matches(text, /\b((?:R|NFR|A|SM)-\d+)\b/g);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(knownIds.has(id), `${file} cites unknown ${id}`).toBe(true);

    // "WBS 9.1", and every code in lists such as "WBS 9.1, 9.2" or "WBS 8.3 and 8.2".
    const wbsCodes = matches(text, /\bWBS (\d+(?:\.\d+)?(?:(?:, | and | or )\d+(?:\.\d+)?)*)/g).flatMap((list) =>
      list.split(/, | and | or /),
    );
    if (file === "08-production-readiness.md") {
      const column = checklist.header.indexOf("WBS");
      for (const row of checklist.rows) if (row[column] !== "—") wbsCodes.push(...row[column].split(", "));
    }
    expect(wbsCodes.length).toBeGreaterThan(0);
    for (const code of wbsCodes) expect(knownWbs.has(code), `${file} cites unknown WBS ${code}`).toBe(true);
  });

  it.each(LATER_DOCS)("%s numbers its P-, MVP- and PRD- rows uniquely", (file) => {
    const rowIds = matches(read(file), /^\| ((?:P|MVP|PRD)-\d+) \|/gm);
    expect(rowIds.length).toBeGreaterThan(0);
    expect(rowIds.filter((id, i) => rowIds.indexOf(id) !== i), `${file} repeats ids`).toEqual([]);
  });

  it("07 section 2 points only at evidence files that exist", () => {
    const column = findings.header.indexOf("Evidence");
    expect(column).toBeGreaterThan(0);
    for (const row of findings.rows) {
      const paths = matches(row[column], /`([^`\s]+\/[^`\s]*)`/g);
      expect(paths.length, `${row[0]} names no evidence path`).toBeGreaterThan(0);
      for (const path of paths) expect(existsSync(resolve(ROOT, path)), `${row[0]}: ${path} does not exist`).toBe(true);
    }
  });
});

describe("proposed mockups (docs/process/mockups)", () => {
  const mockupsDir = resolve(DIR, "mockups");
  const imagesDir = resolve(DIR, "images");
  const design = read("06-design-and-mockups.md");

  /** `--name: #HEX` declarations inside the first `:root { ... }` block of a CSS file. */
  const rootColours = (css: string): Map<string, string> => {
    const start = css.indexOf(":root {");
    if (start < 0) throw new Error("no :root block");
    const end = css.indexOf("\n}", start);
    const block = css.slice(start, end);
    return new Map([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => [m[1], m[2].toUpperCase()]));
  };

  it("tokens.css has the same colour values as the app's globals.css (no drift)", () => {
    const mockup = rootColours(readFileSync(resolve(mockupsDir, "tokens.css"), "utf8"));
    const app = rootColours(readFileSync(resolve(ROOT, "src/app/globals.css"), "utf8"));
    expect(mockup.size).toBeGreaterThan(30);
    for (const [name, value] of mockup) {
      expect(app.get(name), `${name} is missing from src/app/globals.css`).toBeDefined();
      expect(value, `${name} differs from src/app/globals.css`).toBe(app.get(name));
    }
  });

  const pages = readdirSync(mockupsDir).filter((f) => f.endsWith(".html"));

  it("has the ten proposed pages", () => {
    expect(pages.length).toBe(10);
  });

  it.each(pages.map((f) => [f] as const))("%s carries the PROPOSED banner, uses tokens.css and has a rendered image", (file) => {
    const html = readFileSync(resolve(mockupsDir, file), "utf8");
    expect(html).toContain("PROPOSED MOCKUP — not built · for review");
    expect(html).toContain('href="tokens.css"');
    if (file.startsWith("ai-")) expect(html).toContain("CONCEPT — Phase 2, gated by G1, not a commitment");
    const image = `proposed-${file.replace(/\.html$/, "")}.png`;
    expect(existsSync(resolve(imagesDir, image)), `${image} is missing: run render-mockups.mjs`).toBe(true);
    expect(design, `${image} is not shown in 06`).toContain(`images/${image}`);
  });

  it("06 section 6 lists exactly the questions asked in section 5", () => {
    const section5 = design.slice(design.indexOf("## 5. Proposed mockups"), design.indexOf("## 6. Review checklist"));
    const asked = [...section5.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    const checklist = readTable(design, "#").rows.map((r) => Number(r[0]));
    expect(asked.length).toBeGreaterThan(0);
    expect(checklist).toEqual(asked);
    for (const row of readTable(design, "#").rows) expect(row.length).toBe(4);
  });
});
