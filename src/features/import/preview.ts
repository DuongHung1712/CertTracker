import type { ImportRowView } from "@/features/import/queries";
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

const MAX_LISTED_NAMES = 3;

export const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

type CatalogRef = { id: string } | { name: string };

/** The display name of a catalog reference that does not exist yet; `null` for an existing one. */
function newName(ref: CatalogRef | null): string | null {
  return ref !== null && "name" in ref ? ref.name : null;
}

/** First spelling wins per folded key, in file order. */
function addFirst(into: Map<string, string>, key: string, label: string) {
  if (!into.has(key)) into.set(key, label);
}

/**
 * "Will create: 1 member (Ha), 2 providers, …" from the `create` rows only (an update or skipped row
 * never creates anything). Only non-empty groups appear; `null` when there is nothing new.
 */
export function describeNewEntities(rows: ImportRowView[]): string | null {
  const members = new Map<string, string>();
  const providers = new Map<string, string>();
  const certTypes = new Map<string, string>();
  const courses = new Map<string, string>();

  for (const row of rows) {
    if (row.action !== "create" || row.errors.length > 0 || row.refs === null) continue;
    const { member, course } = row.refs;
    if ("email" in member) addFirst(members, member.email.toLowerCase(), member.fullName);
    if (!("name" in course)) continue;
    const providerName = newName(course.provider);
    const certTypeName = newName(course.certType);
    if (providerName !== null) addFirst(providers, foldText(providerName), providerName);
    if (certTypeName !== null) addFirst(certTypes, foldText(certTypeName), certTypeName);
    // A course is unique per (provider, name); an existing provider is keyed by its id.
    const providerKey = "id" in course.provider ? course.provider.id : `new:${foldText(course.provider.name)}`;
    addFirst(courses, `${providerKey}|${foldText(course.name)}`, course.name);
  }

  const groups: string[] = [];
  if (members.size > 0) {
    const names = [...members.values()];
    const listed = names.slice(0, MAX_LISTED_NAMES).join(", ");
    const rest = names.length - MAX_LISTED_NAMES;
    groups.push(`${plural(members.size, "member")} (${rest > 0 ? `${listed} and ${rest} more` : listed})`);
  }
  if (providers.size > 0) groups.push(plural(providers.size, "provider"));
  if (certTypes.size > 0) groups.push(plural(certTypes.size, "certificate type"));
  if (courses.size > 0) groups.push(plural(courses.size, "course"));
  return groups.length > 0 ? `Will create: ${groups.join(", ")}` : null;
}
