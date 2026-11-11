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
import { listDataQualityIssues } from "@/features/data-quality/queries";
import { listMembers, listTeamOptionsForCurrentUser } from "@/features/members/queries";
import { listCertificateOptions, listRecords, listStudyCourses } from "@/features/records/queries";
import { formatDateTimeVn } from "@/lib/format";

type SignedInUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Each query settles on its own, so one failure only blanks its own section. */
export async function loadAdminDashboard(user: SignedInUser) {
  const { memberId } = user;
  const [
    kpis,
    courses,
    teams,
    certTypes,
    providers,
    ranking,
    records,
    dqIssues,
    careerResult,
    membersResult,
  ] = await Promise.all([
    settle(getDashboardKpis()),
    settle(getBreakdown("certificate", 10)),
    settle(getBreakdown("team")),
    settle(getBreakdown("cert_type")),
    settle(getBreakdown("provider")),
    settle(getRanking()),
    settle(listRecords()),
    settle(listDataQualityIssues()),
    settle(memberId ? getMemberCareer(memberId) : Promise.resolve(null)),
    settle(memberId ? listMembers() : Promise.resolve([])),
  ]);

  const now = new Date();
  const currentMember = (membersResult.ok && membersResult.data.find((m) => m.id === memberId)) || null;
  const profileFailure = [careerResult, membersResult].find((r) => !r.ok);

  const profile = resolveMemberProfile({
    member: currentMember,
    firstRecord: undefined,
    career: careerResult.ok ? careerResult.data : null,
    email: user.email,
  });

  const greeting = getGreeting(profile.fullName, now);
  const subtitle = `Figures as of ${formatDateTimeVn(now.toISOString())}.`;

  return {
    greeting,
    subtitle,
    profile,
    profileError: profileFailure && !profileFailure.ok ? profileFailure.error : undefined,
    kpis,
    courses,
    teams,
    certTypes,
    providers,
    ranking,
    records,
    dqIssues,
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof loadAdminDashboard>>;

export async function loadMemberDashboard(
  user: SignedInUser,
  memberId: string,
): Promise<ComponentProps<typeof MemberDashboardView>> {
  const [recordsResult, certificateOptionsResult, studyCoursesResult, careerResult, membersResult] = await Promise.all([
    settle(listRecords({ memberId })),
    settle(listCertificateOptions()),
    settle(listStudyCourses()),
    settle(getMemberCareer(memberId)),
    settle(listMembers()),
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
    certificateOptions: certificateOptionsResult.ok ? certificateOptionsResult.data : [],
    studyCourses: studyCoursesResult.ok ? studyCoursesResult.data : [],
    subtitle: `${getGreeting(profile.fullName, now)} · Figures as of ${formatDateTimeVn(now.toISOString())}.`,
  };
}

export async function loadManagerDashboard(
  user: SignedInUser,
): Promise<ComponentProps<typeof ManagerDashboardView>> {
  const [recordsResult, membersResult, managedTeamsResult] = await Promise.all([
    settle(listRecords()),
    settle(listMembers()),
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
    teamsError: managedTeamsResult.ok ? undefined : managedTeamsResult.error,
    records,
    recordsError: recordsResult.ok ? undefined : recordsResult.error,
    members,
    membersError: membersResult.ok ? undefined : membersResult.error,
  };
}
