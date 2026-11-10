import { cellText, normalizeEmail, type Cell, type Cleaned } from "@/features/import/clean";
import { foldText } from "@/lib/text";

export const MEMBER_IMPORT_HEADERS = {
  fullName: ["full name", "name", "ho ten", "ho va ten"],
  email: ["email", "e-mail"],
  team: ["team", "nhom"],
  careerRole: ["career role", "role"],
} as const;

export const MAX_MEMBER_IMPORT_ROWS = 500;
const HEADER_SCAN_ROWS = 10;
const DUPLICATE_MESSAGE = "This email appears more than once in the file";

type Field = keyof typeof MEMBER_IMPORT_HEADERS;
type Columns = Partial<Record<Field, number>>;
type Named = { id: string; name: string };

export type MemberImportRow = {
  line: number;
  fullName: string | null;
  email: string | null;
  teamName: string | null;
  careerRoleName: string | null;
  action: "create" | "skip" | "error";
  messages: string[];
  teamId: string | null;
  careerRoleId: string | null;
};

export type MemberImportLookups = { memberEmails: string[]; teams: Named[]; careerRoles: Named[] };

const fail = <T>(error: string): Cleaned<T> => ({ ok: false, error });

/** First of the first rows that names both Full name and Email; a second column for the same field is reported. */
function findHeader(rows: Cell[][]): { index: number; columns: Columns; duplicate: string | null } | null {
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_ROWS); index++) {
    const columns: Columns = {};
    let duplicate: string | null = null;
    (rows[index] ?? []).forEach((cell, column) => {
      const text = cellText(cell);
      if (text === null) return;
      const key = foldText(text);
      for (const field of Object.keys(MEMBER_IMPORT_HEADERS) as Field[]) {
        if (!(MEMBER_IMPORT_HEADERS[field] as readonly string[]).includes(key)) continue;
        if (columns[field] === undefined) columns[field] = column;
        else duplicate ??= text;
      }
    });
    if (columns.fullName !== undefined && columns.email !== undefined) return { index, columns, duplicate };
  }
  return null;
}

type Match = { id: string | null; ambiguous: boolean };

/** Exact trimmed name first, then the accent- and case-folded name; never picks an id when several candidates remain. */
function resolveName(items: Named[], name: string): Match {
  const exact = items.filter((item) => item.name.trim() === name);
  const candidates = exact.length > 0 ? exact : items.filter((item) => foldText(item.name) === foldText(name));
  return { id: candidates.length === 1 ? candidates[0]!.id : null, ambiguous: candidates.length > 1 };
}

type RowContext = { known: Set<string>; teams: Named[]; careerRoles: Named[] };

function problem(match: Match, label: string, name: string, plural: string): string | null {
  if (match.ambiguous) return `${label} "${name}" matches more than one ${plural}`;
  return match.id === null ? `${label} "${name}" does not exist` : null;
}

function planRow(cells: Cell[], line: number, columns: Columns, context: RowContext): MemberImportRow {
  const at = (field: Field) => (columns[field] === undefined ? null : cellText(cells[columns[field]]));
  const fullName = at("fullName");
  const teamName = at("team");
  const careerRoleName = at("careerRole");
  const email = normalizeEmail(columns.email === undefined ? null : cells[columns.email]);
  const base = { line, fullName, email: email.ok ? email.value : at("email"), teamName, careerRoleName, teamId: null, careerRoleId: null };

  // Skip uses none of the other cells (decision #21).
  if (email.ok && context.known.has(email.value)) return { ...base, action: "skip", messages: [] };

  const messages: string[] = [];
  if (fullName === null) messages.push("Full name is missing");
  if (!email.ok) messages.push(email.error);
  if (teamName === null) messages.push("Team is missing");
  const team = teamName === null ? null : resolveName(context.teams, teamName);
  const role = careerRoleName === null ? null : resolveName(context.careerRoles, careerRoleName);
  const teamProblem = team && problem(team, "Team", teamName!, "team");
  const roleProblem = role && problem(role, "Career role", careerRoleName!, "career role");
  if (teamProblem) messages.push(teamProblem);
  if (roleProblem) messages.push(roleProblem);

  return { ...base, action: messages.length > 0 ? "error" : "create", messages, teamId: team?.id ?? null, careerRoleId: role?.id ?? null };
}

/** An email shared by several rows makes every one of them an error. */
function markDuplicateEmails(rows: MemberImportRow[]) {
  const seen = new Map<string, number>();
  for (const row of rows) if (row.email) seen.set(row.email, (seen.get(row.email) ?? 0) + 1);
  for (const row of rows) {
    if (row.email && (seen.get(row.email) ?? 0) > 1) {
      row.action = "error";
      row.messages.push(DUPLICATE_MESSAGE);
    }
  }
}

export function planMemberImport(
  rows: Cell[][],
  lookups: MemberImportLookups,
): Cleaned<{ rows: MemberImportRow[]; counts: { create: number; skip: number; error: number } }> {
  const header = findHeader(rows);
  if (!header) return fail("The file needs the columns Full name and Email.");
  if (header.duplicate) return fail(`Column "${header.duplicate}" means the same as another column. Delete or rename one of them.`);

  const data = rows
    .map((cells, index) => ({ cells, line: index + 1 }))
    .slice(header.index + 1)
    .filter(({ cells }) => cells.some((cell) => cellText(cell) !== null));
  if (data.length > MAX_MEMBER_IMPORT_ROWS) return fail("The file has more than 500 rows. Split it and import it in parts.");

  const known = new Set(lookups.memberEmails.map((email) => email.trim().toLowerCase()));
  const context = { known, teams: lookups.teams, careerRoles: lookups.careerRoles };
  const planned = data.map(({ cells, line }) => planRow(cells, line, header.columns, context));
  markDuplicateEmails(planned);

  const counts = { create: 0, skip: 0, error: 0 };
  for (const row of planned) counts[row.action]++;
  return { ok: true, value: { rows: planned, counts } };
}
