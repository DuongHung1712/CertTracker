"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UserGuideCard, type UserGuideProps } from "@/features/guide/components/user-guide-card";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ManagerAttentionList } from "@/features/dashboard/components/manager/manager-attention-list";
import { ManagerTeamTable } from "@/features/dashboard/components/manager/manager-team-table";
import { TeamScopeFilter } from "@/features/dashboard/components/manager/team-scope-filter";
import { Section, SectionError } from "@/features/dashboard/components/section";
import { SummaryTile } from "@/features/dashboard/components/summary-tile";
import { WaitingTile } from "@/features/dashboard/components/waiting-tile";
import { calculateManagerKpis, getMembersWithoutCerts, getTeamReadinessLeague } from "@/features/dashboard/manager-metrics";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { isReviewable } from "@/features/records/kind";
import type { RecordRow } from "@/features/records/queries";
import { formatNumber } from "@/lib/format";
import { pluralize } from "@/lib/plural";

/**
 * What a manager does here: approve what members submit, chase expiring certificates and see who is ready. Four numbers, one
 * list of what needs attention, and the team. Everything else lives in Learning, Members and Data quality.
 */
export function ManagerDashboardView({
  greeting,
  subtitle,
  managedTeamNames,
  teamsError,
  records,
  recordsError,
  members,
  membersError,
  learningError,
  viewerMemberId = null,
  guide,
}: {
  /** The sign-in guide: shown under the header, never above it. */
  guide?: UserGuideProps;
  greeting: string;
  subtitle: string;
  managedTeamNames: string[];
  teamsError?: string;
  records: RecordRow[];
  recordsError?: string;
  members: { id: string; fullName: string; teamName: string | null }[];
  membersError?: string;
  /** Learning items (planned exams, in progress) could not be loaded: the lists say so instead of looking complete. */
  learningError?: string;
  /** The manager's own member row: their own waiting item is not theirs to review, so it is not counted. */
  viewerMemberId?: string | null;
}) {
  const [pickedTeam, setSelectedTeam] = useState<string | null>(null);
  const hasTeams = managedTeamNames.length > 0;
  // A manager of a single team has nothing to pick: no team filter and no team column.
  const manyTeams = managedTeamNames.length > 1;
  // A team that left the manager's scope (or a single team left) falls back to all teams instead of an empty page.
  const selectedTeam = manyTeams && pickedTeam && managedTeamNames.includes(pickedTeam) ? pickedTeam : null;

  const filteredRecords = useMemo(() => (selectedTeam ? records.filter((r) => r.teamName === selectedTeam) : records), [records, selectedTeam]);
  const filteredMembers = useMemo(() => (selectedTeam ? members.filter((m) => m.teamName === selectedTeam) : members), [members, selectedTeam]);

  const kpis = useMemo(() => calculateManagerKpis(filteredRecords), [filteredRecords]);
  const waiting = useMemo(() => filteredRecords.filter((r) => isReviewable(r, viewerMemberId)).length, [filteredRecords, viewerMemberId]);
  const waitingHref = selectedTeam ? `/records?approval=waiting&team=${encodeURIComponent(selectedTeam)}` : "/records?approval=waiting";
  const withoutCertificate = useMemo(() => getMembersWithoutCerts(filteredMembers, filteredRecords).length, [filteredMembers, filteredRecords]);
  const teamRows = useMemo(() => getTeamReadinessLeague(filteredMembers, filteredRecords), [filteredMembers, filteredRecords]);
  const teamsWithCounts = useMemo(
    () => managedTeamNames.map((name) => ({ name, memberCount: members.filter((m) => m.teamName === name).length })),
    [managedTeamNames, members],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`${greeting} · ${subtitle}`}
        actions={
          hasTeams ? (
            <div className="flex flex-wrap items-center gap-2">
              <ExportLinks label="Download team data" />
              <Link href="/records" className={buttonVariants()}>
                View learning
              </Link>
            </div>
          ) : undefined
        }
      />

      {guide && <UserGuideCard {...guide} />}

      <RecordsRealtime />

      {teamsError ? (
        <SectionError title="Your teams" />
      ) : !hasTeams ? (
        <EmptyState
          title="No teams assigned yet"
          description="Ask an admin to assign you as a manager to a team or program so your team's certificates show here."
          action={
            <Link href="/records" className={buttonVariants()}>
              View learning
            </Link>
          }
        />
      ) : (
        <>
          {manyTeams && <TeamScopeFilter teams={teamsWithCounts} selectedTeam={selectedTeam} onSelectTeam={setSelectedTeam} />}

          <section aria-label="Overview" className="flex flex-col gap-3">
            <h2 className="sr-only">Overview</h2>
            {recordsError ? (
              <SectionError title="Overview" />
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <WaitingTile count={waiting} href={waitingHref} />
                <SummaryTile
                  label="Expiring in 60 days"
                  value={kpis.expiringCount}
                  summary={kpis.expiringCount === 0 ? "Nothing expiring soon" : `${kpis.urgentCount} within 30 days`}
                  footer="Listed under Needs attention"
                  tone={kpis.urgentCount > 0 ? "warning" : "neutral"}
                />
                <SummaryTile
                  label="Expired"
                  value={kpis.expiredCount}
                  summary={kpis.expiredCount === 0 ? "Nothing has expired" : "Past the expiry date"}
                  footer={kpis.expiredCount === 0 ? "All up to date" : "Listed under Needs attention"}
                  tone={kpis.expiredCount > 0 ? "danger" : "neutral"}
                />
                <SummaryTile
                  label="Valid certificates"
                  value={formatNumber(kpis.validCount)}
                  summary={
                    kpis.doneCount === 0
                      ? "No completed certificates yet"
                      : `of ${formatNumber(kpis.doneCount)} completed · ${kpis.teamReadinessFormatted}`
                  }
                  footer={membersError ? "Members could not be loaded" : `${pluralize(withoutCertificate, "member")} without a certificate`}
                />
              </div>
            )}
          </section>

          {recordsError || membersError ? (
            <SectionError title="Needs attention" />
          ) : (
            <ManagerAttentionList
              records={filteredRecords}
              members={filteredMembers}
              showTeam={manyTeams && !selectedTeam}
              selectedTeam={selectedTeam}
              incomplete={Boolean(learningError)}
            />
          )}

          <Section title="My team" description="Each person's valid certificates and what needs renewing. Select a name to see their certificates.">
            {recordsError || membersError ? <SectionError title="My team" /> : <ManagerTeamTable rows={teamRows} showTeam={manyTeams && !selectedTeam} />}
          </Section>
        </>
      )}
    </div>
  );
}
