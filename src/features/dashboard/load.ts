import type { ComponentProps } from "react";
import type { getCurrentUser } from "@/features/auth/queries";
import { getMemberCareer } from "@/features/career/queries";
import type { ManagerDashboardView } from "@/features/dashboard/components/manager/manager-dashboard-view";
import type { MemberDashboardView } from "@/features/dashboard/components/member/member-dashboard-view";
import { formatManagerSubtitle } from "@/features/dashboard/manager-metrics";
import { getGreeting } from "@/features/dashboard/member-metrics";
import { getBreakdown, getDashboardKpis, getRanking } from "@/features/dashboard/queries";
import { settle } from "@/features/dashboard/settle";
import { resolveMemberProfile } from "@/features/dashboard/view-model";
import { listMembers, listTeamOptionsForCurrentUser } from "@/features/members/queries";
import { listCourseOptions, listRecords } from "@/features/records/queries";
import { formatDateTimeVn } from "@/lib/format";

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

  const now = new Date();
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
    subtitle: `${getGreeting(profile.fullName, now)} · Figures as of ${formatDateTimeVn(now.toISOString())}.`,
  };
}

export async function loadManagerDashboard(
  user: SignedInUser,
): Promise<ComponentProps<typeof ManagerDashboardView>> {
  const [recordsResult, membersResult, kpisResult, managedTeamsResult] = await Promise.all([
    settle(listRecords()),
    settle(listMembers()),
    settle(getDashboardKpis()),
    settle(listTeamOptionsForCurrentUser()),
  ]);

  const now = new Date();
  const allRecords = recordsResult.ok ? recordsResult.data : [];
  const allMembers = membersResult.ok ? membersResult.data : [];

  const managedTeamOptions = managedTeamsResult.ok ? managedTeamsResult.data : [];
  const managedTeamNames = managedTeamOptions.map((t) => t.name);
  const managedTeamIds = new Set(managedTeamOptions.map((t) => t.id));

  // If the manager has managed teams, filter members and records to those managed teams
  const members = managedTeamNames.length > 0
    ? allMembers.filter((m) => m.teamId && managedTeamIds.has(m.teamId))
    : [];
  const records = managedTeamNames.length > 0
    ? allRecords.filter((r) => r.teamId && managedTeamIds.has(r.teamId))
    : [];

  const currentMember = user.memberId ? allMembers.find((m) => m.id === user.memberId) : null;
  const displayName = currentMember?.fullName ?? user.email;

  const greeting = getGreeting(displayName, now);
  const subtitle = formatManagerSubtitle(managedTeamNames, members.length);

  return {
    greeting,
    subtitle,
    managedTeamNames,
    records,
    recordsError: recordsResult.ok ? undefined : recordsResult.error,
    members,
    membersError: membersResult.ok ? undefined : membersResult.error,
    departmentKpis: kpisResult.ok ? kpisResult.data : null,
    departmentKpisError: kpisResult.ok ? undefined : kpisResult.error,
  };
}
