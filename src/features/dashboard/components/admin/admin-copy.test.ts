import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Source scan scoped to the admin dashboard: no mock values, no dead controls.
// Reads string literals, template text and JSX text only.

const DIR = join(process.cwd(), "src/features/dashboard/components/admin");
const toRepoPath = (file: string) => relative(process.cwd(), file).split(sep).join("/");
const files = [
  ...readdirSync(DIR)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => join(DIR, name)),
  join(process.cwd(), "src/features/dashboard/admin-metrics.ts"),
];

const parse = (file: string) =>
  ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

type Piece = { where: string; text: string };

function textPieces(file: string): Piece[] {
  const source = parse(file);
  const pieces: Piece[] = [];
  const push = (node: ts.Node, text: string) =>
    pieces.push({
      where: `${toRepoPath(file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
      text,
    });
  const visit = (node: ts.Node) => {
    const isModulePath =
      ts.isStringLiteral(node) &&
      (ts.isImportDeclaration(node.parent) ||
        ts.isExportDeclaration(node.parent) ||
        ts.isLiteralTypeNode(node.parent));
    if (ts.isStringLiteral(node) && !isModulePath) push(node, node.text);
    else if (
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      push(node, node.text);
    else if (ts.isJsxText(node) && node.text.trim() !== "") push(node, node.text.trim());
    ts.forEachChild(node, visit);
  };
  visit(source);
  return pieces;
}

const pieces = files.flatMap(textPieces);

/** Banned anywhere inside a piece of visible text. */
const BANNED = [
  "DC34",
  "Lead Auditor",
  "AUDIT READY",
  "Keys enabled",
  "⌘N",
  "HRIS sync",
  "Send reminder",
  "Review submissions",
  "4 pending proofs",
  "Team Cloud achieved 100% validity",
  "Legal Expiration Guard",
  "Audit Hash",
  "#0E5C-TC9",
  "Minh Pham",
  "Zero Expirations",
  "Production IAM",
  "Escalation Level 1",
  "Subsidized certs",
  "Who expires next?",
  "Team Cloud readiness",
  "Review queue",
];

/** Banned as a whole piece (too short to ban as a substring). */
const BANNED_EXACT = ["INV", "XLS", "CSV", "Month", "Quarter", "Year", "Soon Q4", "DC34"];

describe("[copy] admin dashboard has no mock data", () => {
  it("reads the admin files (self-check of the scanner)", () => {
    expect(
      pieces.some(
        (p) => p.where.includes("admin-profile-card.tsx") && p.text === "Workspace ledger",
      ),
    ).toBe(true);
  });

  it("contains none of the invented strings", () => {
    const hits = pieces
      .filter(
        (p) =>
          BANNED.some((word) => p.text.includes(word)) || BANNED_EXACT.includes(p.text.trim()),
      )
      .map((p) => `${p.where}: ${JSON.stringify(p.text)}`);
    expect(hits).toEqual([]);
  });
});

describe("[controls] every admin button does something", () => {
  function deadButtons(file: string): string[] {
    const source = parse(file);
    const out: string[] = [];
    const visit = (node: ts.Node) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening && ["button", "Button"].includes(opening.tagName.getText(source))) {
        const attrs = new Map(
          opening.attributes.properties
            .filter(ts.isJsxAttribute)
            .map((a) => [
              a.name.getText(source),
              a.initializer ? a.initializer.getText(source) : "true",
            ]),
        );
        const isTab = attrs.get("role") === '"tab"';
        const ok =
          attrs.has("onClick") ||
          (isTab && attrs.has("disabled")) ||
          (isTab && attrs.get("aria-selected") === '"true"');
        if (!ok)
          out.push(
            `${toRepoPath(file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
          );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return out;
  }

  it("has no button without a handler, except the disabled Soon tabs and the current tab", () => {
    expect(files.flatMap(deadButtons)).toEqual([]);
  });

  it("has no disabled input (the Coming soon card has no controls)", () => {
    expect(files.filter((f) => /<input\b/.test(readFileSync(f, "utf8"))).map(toRepoPath)).toEqual(
      [],
    );
  });
});
