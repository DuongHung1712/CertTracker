import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  // Invented or rejected words (admin-ux-copy-audit.md, admin-code-review.md I2-I3).
  "Workspace ledger",
  "Flagged",
  "Invite",
  "Workflow",
  "Timeline",
  "Requires immediate renewal",
  "All clear",
  "Track specialization",
  "Phase 2",
  "Compliance",
  "key-person",
  "single-point-of-failure",
  "Download data",
  "Data quality issues",
  "requires attention",
  "≤",
  "&le;",
];

/** Banned in any letter case (a word the app has no concept for). */
const BANNED_ANY_CASE = ["verified", "audit", "pool", "department", "credential"];

/** Banned as a whole piece (too short to ban as a substring). */
const BANNED_EXACT = ["INV", "XLS", "CSV", "Month", "Quarter", "Year", "Soon Q4", "DC34"];

describe("[copy] admin dashboard has no mock data", () => {
  it("reads the admin files (self-check of the scanner)", () => {
    expect(
      pieces.some(
        (p) => p.where.includes("admin-profile-card.tsx") && p.text === "Your profile",
      ),
    ).toBe(true);
  });

  it("contains none of the invented strings", () => {
    const hits = pieces
      .filter(
        (p) =>
          BANNED.some((word) => p.text.includes(word)) ||
          BANNED_ANY_CASE.some((word) => p.text.toLowerCase().includes(word)) ||
          BANNED_EXACT.includes(p.text.trim()),
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

// Tokens, not utility colours (design-system §2): status colours come from --status-* and captions on
// bg-primary use text-primary-foreground-muted instead of opacity. Card headers are sentence case (no all-caps).
describe("[tokens] admin components use design tokens", () => {
  const classStrings = pieces.filter((p) => /\b(?:text|bg|border|opacity|rounded|flex|grid)-/.test(p.text));

  it("uses no amber- or rose- utility colours", () => {
    expect(
      classStrings.filter((p) => /\b(?:amber|rose)-\d/.test(p.text)).map((p) => `${p.where}: ${p.text}`),
    ).toEqual([]);
  });

  // opacity-0 / opacity-100 toggle visibility; any other step dims text below its token contrast.
  it("does not dim text with opacity-<n>", () => {
    expect(
      classStrings
        .filter((p) => /\btext-/.test(p.text) && /(?:^|[\s:])opacity-(?!0\b|100\b)\d+/.test(p.text))
        .map((p) => `${p.where}: ${p.text}`),
    ).toEqual([]);
  });

  it("writes card headers in sentence case (no uppercase class)", () => {
    expect(classStrings.filter((p) => /(?:^|\s)uppercase(?:\s|$)/.test(p.text)).map((p) => p.where)).toEqual([]);
  });

  it("derives the ring circumference from a radius constant, not a literal", () => {
    const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(source).not.toMatch(/circumference\s*=\s*\d/);
  });
});

describe("[cleanup] dead code and fallbacks are gone", () => {
  const SRC = join(process.cwd(), "src");
  const read = (path: string) => readFileSync(join(SRC, path), "utf8");

  it("deletes the dead wrapper, header actions and overview section", () => {
    for (const path of [
      "features/dashboard/components/admin-dashboard.tsx",
      "features/dashboard/components/header-actions.tsx",
      "features/dashboard/components/overview-section.tsx",
    ]) {
      expect(existsSync(join(SRC, path)), path).toBe(false);
    }
  });

  it("renders the admin view straight from the page with the loaded data", () => {
    expect(read("app/(app)/dashboard/page.tsx")).toMatch(
      /<AdminDashboardView\s+\{\.\.\.\(await loadAdminDashboard\(user\)\)\}\s*\/>/,
    );
  });

  it("requires the signed-in user and invents no e-mail", () => {
    const load = read("features/dashboard/load.ts");
    expect(load).not.toContain("admin@example.com");
    expect(load).toMatch(/export async function loadAdminDashboard\(user: SignedInUser\)/);
  });

  it("exports only what other modules use from admin-metrics", () => {
    const metrics = read("features/dashboard/admin-metrics.ts");
    for (const name of ["isAdminExpiring60", "isAdminValid", "isDoneRecord", "EXPIRING_WINDOW_DAYS", "URGENT_WINDOW_DAYS"]) {
      expect(metrics, name).not.toMatch(new RegExp(String.raw`export[^;\n]*\b${name}\b`));
    }
  });

  it("defines getInitials once, in src/lib", () => {
    const all = (readdirSync(SRC, { recursive: true }) as string[])
      .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
      .map((path) => path.split(sep).join("/"))
      .filter((path) => /\b(?:function|const) getInitials\b/.test(read(path)));
    expect(all).toHaveLength(1);
    expect(all[0]).toMatch(/^lib\//);
  });
});
