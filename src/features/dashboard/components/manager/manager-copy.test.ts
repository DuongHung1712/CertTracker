import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Source scan in the style of src/lib/ui-copy.test.ts, scoped to the manager dashboard: no mock values,
// no dead controls. Reads string literals, template text and JSX text only (not identifiers or comments).

const DIR = join(process.cwd(), "src/features/dashboard/components/manager");
const toRepoPath = (file: string) => relative(process.cwd(), file).split(sep).join("/");
const files = [
  ...readdirSync(DIR)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => join(DIR, name)),
  join(process.cwd(), "src/features/dashboard/manager-metrics.ts"),
];

const parse = (file: string) =>
  ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

type Piece = { where: string; text: string };

function textPieces(file: string): Piece[] {
  const source = parse(file);
  const pieces: Piece[] = [];
  const push = (node: ts.Node, text: string) =>
    pieces.push({ where: `${toRepoPath(file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`, text });
  const visit = (node: ts.Node) => {
    const isModulePath = ts.isStringLiteral(node) && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isLiteralTypeNode(node.parent));
    if (ts.isStringLiteral(node) && !isModulePath) push(node, node.text);
    else if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) push(node, node.text);
    else if (ts.isJsxText(node) && node.text.trim() !== "") push(node, node.text.trim());
    ts.forEachChild(node, visit);
  };
  visit(source);
  return pieces;
}

const pieces = files.flatMap(textPieces);

/** Banned anywhere inside a piece of visible text. */
const BANNED = [
  "Program DAS",
  "+28%",
  "Last sent",
  "Joined",
  "Assigned Mentor",
  "Remediate",
  "Notify member",
  "Suggest certification",
  "Send reminder",
  "Review record",
  "Open queue",
  "Assign goal",
  "Pending manager action",
  "proofs queued",
  "Key person risk",
  "Production authority",
  "Subsidized exams",
  "Cloud certification coverage",
  "Who needs renewal",
  "Review queued evidence",
  "Set quarterly goal",
  "View skill matrix",
  "View risk assessment",
  "Individual ranking",
  "Download report",
  "Export team audit CSV",
  "Monthly audit report",
  "Team member",
  "Team Cloud",
  "≤",
];

/** Banned as a whole piece (too short to ban as a substring). */
const BANNED_EXACT = ["DAS", "Program", "Month", "Quarter", "Year", "Approvals (2)", "Skill Matrix"];

describe("[copy] manager dashboard has no mock data", () => {
  it("reads the manager files (self-check of the scanner)", () => {
    expect(pieces.some((p) => p.where.includes("manager-dashboard-view.tsx") && p.text === "View learning")).toBe(true);
  });

  it("contains none of the invented strings", () => {
    const hits = pieces
      .filter((p) => BANNED.some((word) => p.text.includes(word)) || BANNED_EXACT.includes(p.text.trim()))
      .map((p) => `${p.where}: ${JSON.stringify(p.text)}`);
    expect(hits).toEqual([]);
  });

  it("does not use the word dossier", () => {
    expect(pieces.filter((p) => /dossier/i.test(p.text)).map((p) => `${p.where}: ${JSON.stringify(p.text)}`)).toEqual([]);
  });
});

describe("[controls] every manager button does something", () => {
  /** `<button>` / `<Button>` elements: each needs onClick, or is a disabled Soon tab, or is the current tab. */
  function deadButtons(file: string): string[] {
    const source = parse(file);
    const out: string[] = [];
    const visit = (node: ts.Node) => {
      const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
      if (opening && ["button", "Button"].includes(opening.tagName.getText(source))) {
        const attrs = new Map(
          opening.attributes.properties
            .filter(ts.isJsxAttribute)
            .map((a) => [a.name.getText(source), a.initializer ? a.initializer.getText(source) : "true"]),
        );
        const isTab = attrs.get("role") === '"tab"';
        const ok =
          attrs.has("onClick") ||
          (isTab && attrs.has("disabled")) ||
          (isTab && attrs.get("aria-selected") === '"true"');
        if (!ok) out.push(`${toRepoPath(file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return out;
  }

  it("has no button without a handler, except the disabled Soon tabs and the current tab", () => {
    expect(files.flatMap(deadButtons)).toEqual([]);
  });

  it("has no disabled input (the Ask about my team card has no controls)", () => {
    expect(files.filter((f) => /<input\b/.test(readFileSync(f, "utf8"))).map(toRepoPath)).toEqual([]);
  });
});
