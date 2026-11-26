import { NO_TEAM_LABEL } from "@/components/status/labels";
import { formatDate } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import { ISSUE_TYPES, type IssueRow, type IssueType } from "@/features/data-quality/schema";

/** `href` is the screen where the finding is fixed; the list pages have no deep link to a single row. */
export const ISSUE_META: Record<IssueType, { label: string; href: string }> = {
  overdue_exam: { label: "Exam overdue", href: "/records?tab=learning" },
  done_no_evidence: { label: "Missing evidence", href: "/records" },
  member_no_team: { label: NO_TEAM_LABEL, href: "/members" },
  certificate_no_validity: { label: "Exam validity not set", href: "/courses" },
  // A member-proposed catalogue entry waits for the admin; "Open" shows it in the Catalogue tab it belongs to.
  course_proposal: { label: "Course proposal", href: "/courses?tab=courses" },
  certificate_proposal: { label: "Certificate proposal", href: "/courses?tab=certificates" },
};

/** The two proposal types: their `certificateName` is the proposed name and `member*` is the proposer. */
export const PROPOSAL_TYPES = ["course_proposal", "certificate_proposal"] as const satisfies readonly IssueType[];
export const isProposal = (type: IssueType): type is (typeof PROPOSAL_TYPES)[number] => PROPOSAL_TYPES.some((t) => t === type);

/** Findings about a catalogue entry (its name is in `certificateName`), not about a person. */
export const isCatalogueIssue = (type: IssueType): boolean => type === "certificate_no_validity" || isProposal(type);

/** Where "Open" goes: the list page, already searched for the person (or exam certificate) the finding is about. */
export function issueHref(row: IssueRow): string {
  const { href } = ISSUE_META[row.type];
  const subject = isCatalogueIssue(row.type) ? row.certificateName : row.memberName;
  if (!subject) return href;
  const tab = row.type === "certificate_no_validity" ? "tab=certificates&" : "";
  return `${href}${href.includes("?") ? "&" : "?"}${tab}search=${encodeURIComponent(subject)}`;
}

function proposedBy(row: IssueRow): string {
  const who = [row.memberCode, row.memberName].filter(Boolean).join(" ") || "a member";
  const prefix = row.providerName ? `${row.providerName} · ` : "";
  return `${prefix}Proposed by ${who} on ${formatDate(row.since)}.`;
}

export function describeIssue(row: IssueRow): string {
  switch (row.type) {
    case "overdue_exam":
      return `Exam planned for ${formatDate(row.since)} — ${pluralize(row.days, "day")} overdue.`;
    case "done_no_evidence":
      return `Completed on ${formatDate(row.since)} but there is no evidence file or link.`;
    case "member_no_team":
      return `Not in any team (added on ${formatDate(row.since)}).`;
    case "certificate_no_validity":
      return "No validity period is set. Ignore this if the exam certificate does not expire.";
    case "course_proposal":
      return `${proposedBy(row)} Approve also adds a course completion.`;
    case "certificate_proposal":
      return proposedBy(row);
  }
}

export function countByType(rows: IssueRow[]): Record<IssueType, number> {
  const counts = Object.fromEntries(ISSUE_TYPES.map((type) => [type, 0])) as Record<IssueType, number>;
  for (const row of rows) counts[row.type] += 1;
  return counts;
}
