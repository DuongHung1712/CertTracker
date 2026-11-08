"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { DepartmentSummaryCard } from "@/features/dashboard/components/member/department-summary-card";
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
import type { DashboardKpis } from "@/features/dashboard/schema";
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
  departmentKpis,
  departmentKpisError,
}: {
  greeting: string;
  subtitle: string;
  managedTeamNames: string[];
  teamsError?: string;
  records: RecordRow[];
  recordsError?: string;
  members: { id: string; fullName: string; teamName: string | null }[];
  membersError?: string;
  departmentKpis: DashboardKpis | null;
  departmentKpisError?: string;
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

          {/* Row 1: Top Overview (Cols 1 & 2) and Needs Attention (Col 3) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Overview Section wrapping the 4 KPI Tiles */}
            <div className="flex flex-col gap-3 lg:col-span-9">
              <section aria-label="Overview" className="flex flex-col gap-3">
                <h2 className="sr-only">Overview</h2>
                {recordsError ? (
                  <SectionError title="Overview" />
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-9">
                    {/* Left: Donut Readiness Card (3 cols) */}
                    <div className="lg:col-span-3">
                      <TeamReadinessDonutCard
                        kpis={kpis}
                        noCertCount={membersWithoutCerts.length}
                      />
                    </div>
                    {/* Center: Top 3 KPI Cards (6 cols) */}
                    <div className="lg:col-span-6">
                      <TopKpiRow kpis={kpis} pastDueText={pastDueText} />
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right: Needs Attention Card (3 cols) */}
            <div className="lg:col-span-3">
              {recordsError ? (
                <SectionError title="Needs attention" />
              ) : (
                <NeedsAttentionFeed records={filteredRecords} />
              )}
            </div>
          </div>

          {/* Row 2: 3 Continuous Columns matching Figma */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Column 1 (Left sidebar - 3 cols) */}
            <div className="flex flex-col gap-4 lg:col-span-3">
              <AllocatedScopeCard teams={teamsWithCounts} />
              <QuickActionsCard />
              <MonthlyEarnedChart records={filteredRecords} />
            </div>

            {/* Column 2 (Center main column - 6 cols) */}
            <div className="flex flex-col gap-6 lg:col-span-6">
              <ManagerTabStrip />

              {/* Next to expire */}
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

              {/* Team readiness: ranked members with details */}
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

              {/* People without certificates yet */}
              <PeopleWithoutCertsCard members={membersWithoutCerts} />

              {/* Planned exams */}
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
            </div>

            {/* Column 3 (Right sidebar - 3 cols) */}
            <div className="flex flex-col gap-4 lg:col-span-3">
              <AutomatedRemindersCard />
              <AskAboutMyTeamComingSoon />
            </div>
          </div>

          {/* Bottom section: Across the department */}
          <div className="flex flex-col gap-6 border-t border-border pt-6">
            {/* Across the department (Anonymous org totals) */}
            {departmentKpisError ? (
              <SectionError title="Across the department" />
            ) : departmentKpis ? (
              <DepartmentSummaryCard kpis={departmentKpis} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
