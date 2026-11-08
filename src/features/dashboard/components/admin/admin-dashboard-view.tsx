"use client";

import { Explorer } from "@/features/dashboard/components/explorer";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { Section, SectionError } from "@/features/dashboard/components/section";
import { AdminComingSoonCard } from "@/features/dashboard/components/admin/admin-coming-soon-card";
import { AdminHeader } from "@/features/dashboard/components/admin/admin-header";
import { AdminKpiCards } from "@/features/dashboard/components/admin/admin-kpi-cards";
import { AdminNeedsAttention } from "@/features/dashboard/components/admin/admin-needs-attention";
import { AdminProfileCard } from "@/features/dashboard/components/admin/admin-profile-card";
import { AdminQuickActionsCard } from "@/features/dashboard/components/admin/admin-quick-actions-card";
import { AdminTabStrip } from "@/features/dashboard/components/admin/admin-tab-strip";
import { MonthlyEarnedChart } from "@/features/dashboard/components/manager/monthly-earned-chart";
import type { AdminDashboardData } from "@/features/dashboard/load";
import { buildExplorerTabs, type MemberProfile } from "@/features/dashboard/view-model";
import { RecordsRealtime } from "@/features/records/components/records-realtime";

export function AdminDashboardView({
  greeting,
  subtitle,
  profile,
  data,
}: {
  greeting: string;
  subtitle: string;
  profile: MemberProfile;
  data: AdminDashboardData;
}) {
  const { kpis, courses, teams, certTypes, providers, ranking, records, dqIssues } = data;

  const recordsList = records.ok ? records.data : [];
  const dqIssuesCount = dqIssues.ok ? dqIssues.data.length : 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AdminHeader greeting={greeting} subtitle={subtitle} />
      <RecordsRealtime />

      {/*
        Three independent columns matching the Figma layout:
        Centre leads on phone (DOM order 1), followed by Right (DOM order 2), then Left (DOM order 3).
        On desktop (lg), lg:order-* arranges them as Left (3 cols), Centre (6 cols), Right (3 cols).
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 min-w-0">
        {/* Centre column (6 cols on lg, leads on mobile) */}
        <div data-testid="col-center" className="flex flex-col gap-6 lg:order-2 lg:col-span-6 min-w-0">
          {kpis.ok ? (
            <AdminKpiCards kpis={kpis.data} records={recordsList} teams={teams} />
          ) : (
            <SectionError title="Overview" />
          )}

          <AdminTabStrip />

          <Section
            title="Explorer"
            description="Breakdown by team, certificate type, provider or course"
          >
            <Explorer
              tabs={buildExplorerTabs({ teams, certTypes, providers, courses })}
              defaultTab="team"
            />
          </Section>

          <Section
            title="Individual ranking"
            description="Ranked by valid certificates, then by total completed. Equal numbers share a rank."
          >
            {ranking.ok ? (
              <RankingTable rows={ranking.data} />
            ) : (
              <SectionError title="Individual ranking" />
            )}
          </Section>
        </div>

        {/* Right column (3 cols on lg, 2nd on mobile) */}
        <div data-testid="col-right" className="flex flex-col gap-4 lg:order-3 lg:col-span-3 min-w-0">
          {!records.ok ? (
            <SectionError title="Needs attention" />
          ) : (
            <AdminNeedsAttention records={recordsList} dqIssuesCount={dqIssuesCount} />
          )}
          <AdminComingSoonCard />
        </div>

        {/* Left column (3 cols on lg, 3rd on mobile) */}
        <div data-testid="col-left" className="flex flex-col gap-4 lg:order-1 lg:col-span-3 min-w-0">
          <AdminProfileCard profile={profile} />
          <AdminQuickActionsCard />
          {!records.ok ? (
            <SectionError title="Certificates earned" />
          ) : (
            <MonthlyEarnedChart records={recordsList} />
          )}
        </div>
      </div>
    </div>
  );
}
