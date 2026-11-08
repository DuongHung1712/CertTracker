import type { MemberCareer } from "@/features/career/queries";
import type { TabConfig, TabResult } from "@/features/dashboard/components/explorer/types";

export type MemberProfile = {
  fullName: string;
  teamName: string | null;
  careerRoleName: string | null;
  yoeYears: number | null;
};

/** Name and team: member row, then the member's first record, then the e-mail. Role and YoE: career, then member row. */
export function resolveMemberProfile({
  member,
  firstRecord,
  career,
  email,
}: {
  member: MemberProfile | null;
  firstRecord: { memberName: string; teamName: string | null } | undefined;
  career: Pick<MemberCareer, "careerRoleName" | "yoeYears"> | null;
  email: string;
}): MemberProfile {
  return {
    fullName: member?.fullName ?? firstRecord?.memberName ?? email,
    teamName: member?.teamName ?? firstRecord?.teamName ?? null,
    careerRoleName: career?.careerRoleName ?? member?.careerRoleName ?? null,
    yoeYears: career?.yoeYears ?? member?.yoeYears ?? null,
  };
}

/** Explorer tabs for admin and manager, in display order. */
export function buildExplorerTabs(results: {
  teams: TabResult;
  certTypes: TabResult;
  providers: TabResult;
  courses: TabResult;
}): TabConfig[] {
  return [
    { id: "team", label: "By team", groupLabel: "Team", peopleLabel: "Members", result: results.teams },
    { id: "cert_type", label: "By certificate type", groupLabel: "Certificate type", peopleLabel: "Learners", result: results.certTypes },
    { id: "provider", label: "By provider", groupLabel: "Provider", peopleLabel: "Learners", result: results.providers },
    { id: "course", label: "Popular courses", groupLabel: "Course", peopleLabel: "Learners", result: results.courses },
  ];
}
