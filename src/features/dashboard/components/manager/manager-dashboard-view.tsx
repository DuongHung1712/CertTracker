"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { DepartmentSummaryCard } from "@/features/dashboard/components/member/department-summary-card";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { Section, SectionError } from "@/features/dashboard/components/section";
import {
  ApprovalsQueueComingSoon,
  AskAboutMyTeamComingSoon,
  GoalsComingSoon,
  ManagerTabStrip,
  RiskAlertsComingSoon,
  SkillsComingSoon,
} from "@/features/dashboard/components/manager/manager-coming-soon-stack";
import { ManagerKpiCards } from "@/features/dashboard/components/manager/manager-kpi-cards";
import { MonthlyEarnedChart } from "@/features/dashboard/components/manager/monthly-earned-chart";
import { NeedsAttentionFeed } from "@/features/dashboard/components/manager/needs-attention-feed";
import { NextToExpireTable } from "@/features/dashboard/components/manager/next-to-expire-table";
import { PlannedExamsList } from "@/features/dashboard/components/manager/planned-exams-list";
import { TeamReadinessLeague } from "@/features/dashboard/components/manager/team-readiness-league";
import { calculateManagerKpis } from "@/features/dashboard/manager-metrics";
import type { DashboardKpis, RankingRow } from "@/features/dashboard/schema";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import type { RecordRow } from "@/features/records/queries";

export function ManagerDashboardView({
  greeting,
  subtitle,
  managedTeamNames,
  records,
  recordsError,
  members,
  membersError,
  departmentKpis,
  departmentKpisError,
  ranking,
  rankingError,
}: {
  greeting: string;
  subtitle: string;
  managedTeamNames: string[];
  records: RecordRow[];
  recordsError?: string;
  members: { id: string; fullName: string; teamName: string | null }[];
  membersError?: string;
  departmentKpis: DashboardKpis | null;
  departmentKpisError?: string;
  ranking: RankingRow[];
  rankingError?: string;
}) {
  const hasTeams = managedTeamNames.length > 0;
  const kpis = calculateManagerKpis(records);

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

      {!hasTeams ? (
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
          {/* 1. Overview: 4 KPI Cards */}
          <Section title="Overview">
            {recordsError ? (
              <SectionError title="Overview" />
            ) : (
              <ManagerKpiCards kpis={kpis} />
            )}
          </Section>

          {/* 2. Tab strip */}
          <ManagerTabStrip />

          {/* 3. Main 2-column layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: 8 cols */}
            <div className="flex flex-col gap-6 lg:col-span-8">
              {/* Next to expire */}
              <Section
                title="Next to expire"
                description="Completed certificates with 60 days or less left, soonest first."
              >
                {recordsError ? (
                  <SectionError title="Next to expire" />
                ) : (
                  <NextToExpireTable records={records} />
                )}
              </Section>

              {/* Team readiness league */}
              <Section
                title="Team readiness"
                description="Status breakdown for members across your managed teams."
              >
                {membersError || recordsError ? (
                  <SectionError title="Team readiness" />
                ) : (
                  <TeamReadinessLeague members={members} records={records} />
                )}
              </Section>

              {/* Certificates earned by month */}
              <Section title="Certificates earned by month">
                {recordsError ? (
                  <SectionError title="Certificates earned by month" />
                ) : (
                  <MonthlyEarnedChart records={records} />
                )}
              </Section>

              {/* Planned exams */}
              <Section
                title="Planned exams"
                description="Scheduled exams within the next 60 days."
              >
                {recordsError ? (
                  <SectionError title="Planned exams" />
                ) : (
                  <PlannedExamsList records={records} />
                )}
              </Section>

              {/* Individual ranking */}
              <Section
                title="Individual ranking"
                description="Ranked by valid certificates, then by total completed. Equal numbers share a rank. Only members of the teams you manage are included."
              >
                {rankingError ? (
                  <SectionError title="Individual ranking" />
                ) : (
                  <RankingTable rows={ranking} />
                )}
              </Section>
            </div>

            {/* Right Column: 4 cols */}
            <div className="flex flex-col gap-6 lg:col-span-4">
              {/* Needs attention feed */}
              <Section
                title="Needs attention"
                description="Expired certificates and certificates expiring within 30 days."
              >
                {recordsError ? (
                  <SectionError title="Needs attention" />
                ) : (
                  <NeedsAttentionFeed records={records} />
                )}
              </Section>

              {/* Across the department (Anonymous org totals) */}
              {departmentKpisError ? (
                <SectionError title="Across the department" />
              ) : departmentKpis ? (
                <DepartmentSummaryCard kpis={departmentKpis} />
              ) : null}

              {/* Coming soon cards */}
              <ApprovalsQueueComingSoon />
              <GoalsComingSoon />
              <SkillsComingSoon />
              <AskAboutMyTeamComingSoon />
              <RiskAlertsComingSoon />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
