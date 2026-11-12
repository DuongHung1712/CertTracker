import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Guard for the plain-English terms (ux-copy-audit.md §1, §5). It reads only the text a user can see:
// string literals, template text and JSX text. Identifiers (`row.headcount`), comments, import paths and
// file or folder names are never read, so code may keep its own names.

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const toRepoPath = (file: string): string => relative(process.cwd(), file).split(sep).join("/");

const sourceFiles = walk(SRC)
  .map(toRepoPath)
  .filter((file) => /\.tsx?$/.test(file))
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .filter((file) => file !== "src/types/database.ts")
  .filter((file) => !file.includes("/__fixtures__/"));

type Piece = { file: string; line: number; text: string };

/** Every piece of user-visible text in a file. */
function textPieces(file: string): Piece[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const pieces: Piece[] = [];
  const push = (node: ts.Node, text: string) =>
    pieces.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text });
  const visit = (node: ts.Node) => {
    const isModulePath =
      ts.isStringLiteral(node) &&
      (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isExternalModuleReference(node.parent) ||
        (ts.isCallExpression(node.parent) && (node.parent.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.parent.expression) && node.parent.expression.text === "require"))) ||
        ts.isLiteralTypeNode(node.parent));
    if (ts.isStringLiteral(node) && !isModulePath) push(node, node.text);
    else if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) push(node, node.text);
    else if (ts.isJsxText(node) && node.text.trim() !== "") push(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return pieces;
}

const pieces = sourceFiles.flatMap(textPieces);

function offenders(test: (piece: Piece) => boolean): string[] {
  return pieces.filter(test).map((p) => `${p.file}:${p.line}: ${JSON.stringify(p.text.trim())}`);
}

const JARGON = [
  "Dossier",
  "Registry violations",
  "registry violations",
  "Audit compliance",
  "Curriculum coverage",
  "Compliance copilot",
  "Specialization",
  "headcount",
  "Learners",
  "learners",
  "Upload proof",
  "Recorded credentials",
];

describe("[copy] plain-English interface", () => {
  it("reads the text a user sees (self-check of the scanner)", () => {
    expect(pieces.some((p) => p.file === "src/components/status/coming-soon-card.tsx" && p.text === "Coming soon")).toBe(true);
    expect(pieces.some((p) => p.text.includes("@/lib/"))).toBe(false);
    // Attribute literals (aria-label, title, placeholder) are scanned too, not only JSX text.
    expect(pieces.some((p) => p.file === "src/features/dashboard/components/explorer/filter-row.tsx" && p.text === "Filter by certificate status")).toBe(true);
  });

  it("uses none of the rejected words", () => {
    expect(offenders((p) => JARGON.some((word) => p.text.includes(word)))).toEqual([]);
  });

  it("does not shorten words to symbols or abbreviations such as 'exp'", () => {
    expect(offenders((p) => /(^|\s)exp(\s|$)/.test(p.text))).toEqual([]);
  });

  it("has no hard-coded plural mistakes", () => {
    expect(offenders((p) => /\b1 (days|records|members|certificates)\b/.test(p.text))).toEqual([]);
  });

  it("says certificate, not record (record is a database word)", () => {
    // Pieces without a space are code names (`accessorKey: "records"`, `"record-member"`), pieces starting with
    // "/" are routes (`/records`, `/api/records/...`). Neither is shown to a user.
    const visible = (p: Piece) => /\s/.test(p.text.trim()) && !p.text.trim().startsWith("/");
    // Server-only text a user never sees: a `console.error` log line and the verb "record" in a cron warning.
    // The two certificate-catalogue refusals use the wording fixed by spec 2026-11-10 (section 4.2 and 6.1).
    const allowed = (p: Piece) =>
      (p.file === "src/features/certificates/actions.ts" &&
        (p.text === " has records with another course. Change them first." ||
          p.text === "This certificate has records. Delete them first.")) ||
      (p.file === "src/app/api/export/records/route.ts" && p.text === "export: could not load records") ||
      (p.file === "src/features/notifications/deliver.ts" && p.text === ": could not record the failure (");
    expect(offenders((p) => visible(p) && /\brecords?\b/i.test(p.text) && !allowed(p))).toEqual([]);
  });

  it("writes email without a hyphen", () => {
    // The import still accepts an "e-mail" column header from old workbooks; that alias is input, not UI text.
    const allowed = (p: Piece) =>
      (p.file === "src/features/import/clean.ts" || p.file === "src/features/members/import-plan.ts") && p.text === "e-mail";
    expect(offenders((p) => /e-mail/i.test(p.text) && !allowed(p))).toEqual([]);
  });
});
