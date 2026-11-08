import type { ComponentProps } from "react";
import type { getCurrentUser } from "@/features/auth/queries";
import { getMemberCareer } from "@/features/career/queries";
import type { MemberDashboardView } from "@/features/dashboard/components/member/member-dashboard-view";
import { getBreakdown, getDashboardKpis, getRanking } from "@/features/dashboard/queries";
import { settle } from "@/features/dashboard/settle";
import { resolveMemberProfile } from "@/features/dashboard/view-model";
import { listMembers } from "@/features/members/queries";
import { listCourseOptions, listRecords } from "@/features/records/queries";

type SignedInUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Each query settles on its own, so one failure only blanks its own section. */
export async function loadAdminDashboard() {
  const [kpis, courses, teams, certTypes, providers, ranking] = await Promise.all([
    settle(getDashboardKpis()),
    settle(getBreakdown("course", 10)),
    settle(getBreakdown("team")),
    settle(getBreakdown("cert_type")),
    settle(getBreakdown("provider")),
    settle(getRanking()),
  ]);
  return { kpis, courses, teams, certTypes, providers, ranking };
}

export type AdminDashboardData = Awaited<ReturnType<typeof loadAdminDashboard>>;

export async function loadMemberDashboard(
  user: SignedInUser,
  memberId: string,
): Promise<ComponentProps<typeof MemberDashboardView>> {
  const [recordsResult, courseOptionsResult, careerResult, membersResult, kpisResult] = await Promise.all([
    settle(listRecords({ memberId })),
    settle(listCourseOptions()),
    settle(getMemberCareer(memberId)),
    settle(listMembers()),
    settle(getDashboardKpis()),
  ]);

  const profile = resolveMemberProfile({
    member: (membersResult.ok && membersResult.data.find((m) => m.id === memberId)) || null,
    firstRecord: recordsResult.ok ? recordsResult.data[0] : undefined,
    career: careerResult.ok ? careerResult.data : null,
    email: user.email,
  });

  return {
    ...profile,
    memberId,
    records: recordsResult.ok ? recordsResult.data : [],
    recordsError: recordsResult.ok ? undefined : recordsResult.error,
    courseOptions: courseOptionsResult.ok ? courseOptionsResult.data : [],
    departmentKpis: kpisResult.ok ? kpisResult.data : null,
    departmentKpisError: kpisResult.ok ? undefined : kpisResult.error,
  };
}
