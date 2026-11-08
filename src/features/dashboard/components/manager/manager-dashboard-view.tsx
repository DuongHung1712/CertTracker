"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Section, SectionError } from "@/features/dashboard/components/section";
import { AllocatedScopeCard } from "@/features/dashboard/components/manager/allocated-scope-card";
import { AutomatedRemindersCard } from "@/features/dashboard/components/manager/automated-reminders-card";
import {
  AskAboutMyTeamComingSoon,
  ManagerTabStrip,
} from "@/features/dashboard/components/manager/manager-coming-soon-stack";
import { MonthlyEarnedChart } from "@/features/dashboard/components/manager/monthly-earned-chart";
import { NeedsAttentionFeed } from "@/features/dashboard/components/manager/needs-attention-feed";
import { NextToExpireTable } from "@/features/dashboard/components/manager/next-to-expire-table";
import { PeopleWithoutCertsCard } from "@/features/dashboard/components/manager/people-without-certs-card";
import { PlannedExamsList } from "@/features/dashboard/components/manager/planned-exams-list";
import { QuickActionsCard } from "@/features/dashboard/components/manager/quick-actions-card";
import { TeamReadinessDonutCard } from "@/features/dashboard/components/manager/team-readiness-donut-card";
import { TeamReadinessDossier } from "@/features/dashboard/components/manager/team-readiness-dossier";
import { TeamScopeFilter } from "@/features/dashboard/components/manager/team-scope-filter";
import { TopKpiRow } from "@/features/dashboard/components/manager/top-kpi-row";
import {
  calculateManagerKpis,
  getMembersWithoutCerts,
  getTeamReadinessLeague,
  getNeedsAttentionItems,
} from "@/features/dashboard/manager-metrics";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import type { RecordRow } from "@/features/records/queries";

export function ManagerDashboardView({
  greeting,
  subtitle,
  managedTeamNames,
  teamsError,
  records,
  recordsError,
  members,
  membersError,
}: {
  greeting: string;
  subtitle: string;
  managedTeamNames: string[];
  teamsError?: string;
  records: RecordRow[];
  recordsError?: string;
  members: { id: string; fullName: string; teamName: string | null }[];
  membersError?: string;
}) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const hasTeams = managedTeamNames.length > 0;

  // Filter records & members by selected team if user clicked a team pill
  const filteredRecords = useMemo(() => {
    if (!selectedTeam) return records;
    return records.filter((r) => r.teamName === selectedTeam);
  }, [records, selectedTeam]);

  const filteredMembers = useMemo(() => {
    if (!selectedTeam) return members;
    return members.filter((m) => m.teamName === selectedTeam);
  }, [members, selectedTeam]);

  const kpis = useMemo(() => calculateManagerKpis(filteredRecords), [filteredRecords]);

  const teamsWithCounts = useMemo(() => {
    return managedTeamNames.map((name) => ({
      name,
      memberCount: members.filter((m) => m.teamName === name).length,
    }));
  }, [managedTeamNames, members]);

  const readinessRows = useMemo(
    () => getTeamReadinessLeague(filteredMembers, filteredRecords),
    [filteredMembers, filteredRecords],
  );

  const membersWithoutCerts = useMemo(
    () => getMembersWithoutCerts(filteredMembers, filteredRecords),
    [filteredMembers, filteredRecords],
  );

  const mostOverdue = useMemo(() => getNeedsAttentionItems(filteredRecords)[0]?.record, [filteredRecords]);
  const pastDueText = mostOverdue ? `${mostOverdue.memberName} (${mostOverdue.courseName})` : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`${greeting} · ${subtitle}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportLinks label="Download team data" />
            <Link href="/records" className={buttonVariants()}>
              View certificates
            </Link>
          </div>
        }
      />

      <RecordsRealtime />

      {teamsError ? (
        <SectionError title="Your teams" />
      ) : !hasTeams ? (
        <EmptyState
          title="No teams assigned yet"
          description="Ask an admin to assign you as a manager to a team or program so your team's certificates show here."
          action={
            <Link href="/records" className={buttonVariants()}>
              View certificates
            </Link>
          }
        />
      ) : (
        <>
          {/* Subheader filter bar: team scope pills */}
          <TeamScopeFilter
            teams={teamsWithCounts}
            selectedTeam={selectedTeam}
            onSelectTeam={setSelectedTeam}
          />

          {/* Three independent columns (as in the Figma): each one flows down on its own, so a tall card
              in one column never leaves a gap in the next. The centre column comes first in the markup
              so that on a phone the KPIs and the work lists lead; from lg up the columns are reordered.
              The lists are spread so the three columns end at about the same height. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Centre column (6 cols) */}
            <div className="flex flex-col gap-6 lg:order-2 lg:col-span-6">
              <section aria-label="Overview" className="flex flex-col gap-3">
                <h2 className="sr-only">Overview</h2>
                {recordsError ? <SectionError title="Overview" /> : <TopKpiRow kpis={kpis} pastDueText={pastDueText} />}
              </section>

              <ManagerTabStrip />

              <Section
                title="Next to expire"
                description="Completed certificates with 60 days or less left, soonest first."
              >
                {recordsError ? (
                  <SectionError title="Next to expire" />
                ) : (
                  <NextToExpireTable records={filteredRecords} />
                )}
              </Section>

              <Section
                title="Team readiness"
                description="Status breakdown for members across your managed teams."
              >
                {membersError || recordsError ? (
                  <SectionError title="Team readiness" />
                ) : (
                  <TeamReadinessDossier rows={readinessRows} records={filteredRecords} />
                )}
              </Section>
            </div>

            {/* Right column (3 cols) */}
            <div className="flex flex-col gap-4 lg:order-3 lg:col-span-3">
              {recordsError ? (
                <SectionError title="Needs attention" />
              ) : (
                <NeedsAttentionFeed records={filteredRecords} />
              )}
              <PeopleWithoutCertsCard members={membersWithoutCerts} />
              <Section
                title="Planned exams"
                description="Scheduled exams within the next 60 days."
              >
                {recordsError ? (
                  <SectionError title="Planned exams" />
                ) : (
                  <PlannedExamsList records={filteredRecords} />
                )}
              </Section>
              <AutomatedRemindersCard />
              <AskAboutMyTeamComingSoon />
            </div>

            {/* Left column (3 cols) */}
            <div className="flex flex-col gap-4 lg:order-1 lg:col-span-3">
              <section aria-label="Readiness summary">
                {recordsError ? (
                  <SectionError title="Readiness summary" />
                ) : (
                  <TeamReadinessDonutCard kpis={kpis} noCertCount={membersWithoutCerts.length} />
                )}
              </section>
              <AllocatedScopeCard teams={teamsWithCounts} />
              <QuickActionsCard />
              <MonthlyEarnedChart records={filteredRecords} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
