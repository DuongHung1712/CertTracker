import { HEADER_ALIASES, type ImportField } from "@/features/import/clean";
import { hasCourseDetails } from "@/features/import/plan";
import type { ImportRowView } from "@/features/import/queries";
import { pluralize } from "@/lib/plural";
import { foldText } from "@/lib/text";

export type RowOutcome = "create" | "update" | "unchanged" | "error";

export const ROW_OUTCOME_LABEL: Record<RowOutcome, string> = {
  create: "Create",
  update: "Update",
  unchanged: "Unchanged",
  error: "Error",
};

/** A row with any error is an error whatever its stored action (the planner stores those as `skip`). */
export function rowOutcome(row: ImportRowView): RowOutcome {
  if (row.errors.length > 0) return "error";
  if (row.action === "create") return "create";
  if (row.action === "update") return "update";
  return "unchanged";
}

export function countRows(rows: ImportRowView[]): Record<RowOutcome, number> {
  const counts: Record<RowOutcome, number> = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const row of rows) counts[rowOutcome(row)] += 1;
  return counts;
}

/** What the file says in a column, found by header alias (the stored `raw.cells` are keyed by the file's own headers). */
export function rawCell(row: ImportRowView, field: ImportField): string | null {
  const aliases = new Set(HEADER_ALIASES[field]);
  for (const [header, value] of Object.entries(row.raw.cells)) {
    if (!aliases.has(foldText(header)) || value === null || value === "") continue;
    return String(value);
  }
  return null;
}

type CatalogRef = { id: string } | { name: string };

/** The display name of a catalog reference that does not exist yet; `null` for an existing one. */
function newName(ref: CatalogRef | null): string | null {
  return ref !== null && "name" in ref ? ref.name : null;
}

/**
 * A name an entry nearly duplicates: `existing` is in the catalogue, `file` is another new entry of the same file,
 * `provider` is the same certificate name under a different provider (a warning only).
 */
export type Similar = { name: string; source: "existing" | "file" } | { name: string; source: "provider"; provider: string };

/** One thing the import will create: its name, the file rows that need it, and the name it nearly duplicates. */
export type NewEntry = { name: string; detail?: string; rows: number[]; similarTo: Similar | null };
export type NewEntityGroup = "members" | "providers" | "certTypes" | "certificates" | "courses";
export type NewEntities = Record<NewEntityGroup, NewEntry[]>;
/** Names already in the catalogue, for the near-duplicate check. */
export type ExistingNames = {
  providers: { id: string; name: string }[];
  certTypes: string[];
  certificates: { name: string; provider: string }[];
};
export const NO_EXISTING_NAMES: ExistingNames = { providers: [], certTypes: [], certificates: [] };

/** The sentence under a new entry that looks like a duplicate. */
export function similarMessage(similar: Similar): string {
  if (similar.source === "provider") return `"${similar.name}" exists under another provider "${similar.provider}". Check this is not a duplicate.`;
  const where = similar.source === "existing" ? "which already exists" : "which is also new in this file";
  return `Looks like "${similar.name}", ${where}. Check this is not a duplicate.`;
}

/** Case, accents, spacing and punctuation all ignored: "Comp TIA", "CompTIA" and "comptia." are one key. */
export const looseKey = (name: string): string => foldText(name).replace(/[^a-z0-9]/g, "");

/** A different spelling of the same name among `candidates`; `null` when there is none (an identical name is not a near-duplicate). */
export function findSimilar(name: string, candidates: string[]): string | null {
  const key = looseKey(name);
  return key === "" ? null : (candidates.find((candidate) => candidate !== name && looseKey(candidate) === key) ?? null);
}

/** An existing certificate with the same name (loosely) under a provider that is not `provider`. */
function sameNameOtherProvider(name: string, provider: string | undefined, existing: ExistingNames): Similar | null {
  const key = looseKey(name);
  if (key === "" || provider === undefined) return null;
  const match = existing.certificates.find((candidate) => looseKey(candidate.name) === key && looseKey(candidate.provider) !== looseKey(provider));
  return match ? { name: match.name, source: "provider", provider: match.provider } : null;
}

/** First spelling wins per key, in file order; every row that needs the entry is remembered. */
function addEntry(into: Map<string, NewEntry>, key: string, name: string, rowNo: number, detail?: string) {
  const entry = into.get(key);
  if (entry) entry.rows.push(rowNo);
  else into.set(key, { name, ...(detail && { detail }), rows: [rowNo], similarTo: null });
}

/**
 * Everything the batch will create, by name, from the `create` rows only (an update or skipped row never creates
 * anything). An entry whose name nearly duplicates an existing one, or another new one, carries `similarTo`.
 */
export function listNewEntities(rows: ImportRowView[], existing: ExistingNames = NO_EXISTING_NAMES): NewEntities {
  const maps: Record<NewEntityGroup, Map<string, NewEntry>> = {
    members: new Map(), providers: new Map(), certTypes: new Map(), certificates: new Map(), courses: new Map(),
  };

  const certificateProviders = new Map<string, string | undefined>(); // certificate key -> its provider's name
  for (const row of rows) {
    if (row.action !== "create" || row.errors.length > 0 || row.refs === null) continue;
    const { member, course } = row.refs;
    if ("email" in member) addEntry(maps.members, member.email.toLowerCase(), member.fullName, row.rowNo, member.email);
    if (course === null || !("name" in course)) continue;
    const providerName = newName(course.provider);
    const certTypeName = newName(course.certType);
    if (providerName !== null) addEntry(maps.providers, foldText(providerName), providerName, row.rowNo);
    if (certTypeName !== null) addEntry(maps.certTypes, foldText(certTypeName), certTypeName, row.rowNo);
    // A certificate is unique per (provider, name); an existing provider is keyed by its id.
    const providerKey = "id" in course.provider ? course.provider.id : `new:${foldText(course.provider.name)}`;
    const key = `${providerKey}|${foldText(course.name)}`;
    addEntry(maps.certificates, key, course.name, row.rowNo);
    const providerRef = course.provider;
    certificateProviders.set(key, "name" in providerRef ? providerRef.name : existing.providers.find((provider) => provider.id === providerRef.id)?.name);
    if (hasCourseDetails(course)) addEntry(maps.courses, key, course.name, row.rowNo);
  }

  const withSimilar = (group: "providers" | "certTypes" | "certificates"): NewEntry[] => {
    const keyed = [...maps[group].entries()];
    const entries = keyed.map(([, entry]) => entry);
    const catalogueNames = {
      providers: existing.providers.map((provider) => provider.name),
      certTypes: existing.certTypes,
      certificates: existing.certificates.map((certificate) => certificate.name),
    }[group];
    return keyed.map(([key, entry]): NewEntry => {
      const inCatalogue = findSimilar(entry.name, catalogueNames);
      if (inCatalogue !== null) return { ...entry, similarTo: { name: inCatalogue, source: "existing" } };
      const inFile = findSimilar(entry.name, entries.map((other) => other.name));
      if (inFile !== null) return { ...entry, similarTo: { name: inFile, source: "file" } };
      const elsewhere = group === "certificates" ? sameNameOtherProvider(entry.name, certificateProviders.get(key), existing) : null;
      return { ...entry, similarTo: elsewhere };
    });
  };
  return {
    members: [...maps.members.values()],
    providers: withSimilar("providers"),
    certTypes: withSimilar("certTypes"),
    certificates: withSimilar("certificates"),
    courses: [...maps.courses.values()],
  };
}

export const hasNewEntities = (entities: NewEntities): boolean => Object.values(entities).some((group) => group.length > 0);

const MAX_LISTED_ROWS = 5;

/** "row 3", "rows 3, 5", "rows 3, 5, 8, 9, 12 and 4 more". */
export function rowsLabel(rows: number[]): string {
  const listed = rows.slice(0, MAX_LISTED_ROWS).join(", ");
  const rest = rows.length - MAX_LISTED_ROWS;
  return `${rows.length === 1 ? "row" : "rows"} ${rest > 0 ? `${listed} and ${rest} more` : listed}`;
}

/** The two rules, stated apart: rows with errors are left out; the rest either all import or none does. */
export function commitDescription(counts: Record<RowOutcome, number>): string {
  const one = counts.error === 1;
  const left = counts.error > 0
    ? ` ${pluralize(counts.error, "row")} with errors ${one ? "is" : "are"} left out of this import: fix ${one ? "it" : "them"} in the file and upload it again.`
    : "";
  return `Creates ${counts.create} and updates ${counts.update}.${left} The import either completes in full or changes nothing.`;
}
