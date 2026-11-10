import { cellText, normalizeEmail, type Cell, type Cleaned } from "@/features/import/clean";
import { foldText } from "@/lib/text";

export const MEMBER_IMPORT_HEADERS = {
  fullName: ["full name", "name", "ho ten"],
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

/** First of the first rows that names both Full name and Email; the first alias hit per field wins. */
function findHeader(rows: Cell[][]): { index: number; columns: Columns } | null {
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_ROWS); index++) {
    const columns: Columns = {};
    (rows[index] ?? []).forEach((cell, column) => {
      const text = cellText(cell);
      if (text === null) return;
      const key = foldText(text);
      for (const field of Object.keys(MEMBER_IMPORT_HEADERS) as Field[]) {
        if (columns[field] === undefined && (MEMBER_IMPORT_HEADERS[field] as readonly string[]).includes(key)) columns[field] = column;
      }
    });
    if (columns.fullName !== undefined && columns.email !== undefined) return { index, columns };
  }
  return null;
}

const byFoldedName = (items: Named[]) => new Map(items.map((item) => [foldText(item.name), item.id]));

function planRow(cells: Cell[], line: number, columns: Columns, known: Set<string>, teams: Map<string, string>, roles: Map<string, string>): MemberImportRow {
  const at = (field: Field) => (columns[field] === undefined ? null : cellText(cells[columns[field]]));
  const messages: string[] = [];
  const fullName = at("fullName");
  const teamName = at("team");
  const careerRoleName = at("careerRole");
  if (fullName === null) messages.push("Full name is missing");

  const email = normalizeEmail(columns.email === undefined ? null : cells[columns.email]);
  if (!email.ok) messages.push(email.error);

  const teamId = teamName === null ? null : (teams.get(foldText(teamName)) ?? null);
  if (teamName !== null && teamId === null) messages.push(`Team "${teamName}" does not exist`);
  const careerRoleId = careerRoleName === null ? null : (roles.get(foldText(careerRoleName)) ?? null);
  if (careerRoleName !== null && careerRoleId === null) messages.push(`Career role "${careerRoleName}" does not exist`);

  const action = messages.length > 0 ? "error" : known.has(email.ok ? email.value : "") ? "skip" : "create";
  return { line, fullName, email: email.ok ? email.value : at("email"), teamName, careerRoleName, action, messages, teamId, careerRoleId };
}

/** An email shared by several rows makes every one of them an error. */
function markDuplicateEmails(rows: MemberImportRow[]) {
  const seen = new Map<string, number>();
  for (const row of rows) if (row.email) seen.set(row.email, (seen.get(row.email) ?? 0) + 1);
  for (const row of rows) {
    if (row.email && (seen.get(row.email) ?? 0) > 1 && !row.messages.includes(DUPLICATE_MESSAGE)) {
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

  const data = rows
    .map((cells, index) => ({ cells, line: index + 1 }))
    .slice(header.index + 1)
    .filter(({ cells }) => cells.some((cell) => cellText(cell) !== null));
  if (data.length > MAX_MEMBER_IMPORT_ROWS) return fail("The file has more than 500 rows. Split it and import it in parts.");

  const known = new Set(lookups.memberEmails.map((email) => email.trim().toLowerCase()));
  const teams = byFoldedName(lookups.teams);
  const roles = byFoldedName(lookups.careerRoles);
  const planned = data.map(({ cells, line }) => planRow(cells, line, header.columns, known, teams, roles));
  markDuplicateEmails(planned);

  const counts = { create: 0, skip: 0, error: 0 };
  for (const row of planned) counts[row.action]++;
  return { ok: true, value: { rows: planned, counts } };
}
