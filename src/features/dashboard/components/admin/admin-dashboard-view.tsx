import Link from "next/link";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { countIssuedThisMonth } from "@/features/dashboard/admin-metrics";
import { calculateCompletionKpis } from "@/features/dashboard/completion-metrics";
import { AdminComingSoonCard } from "@/features/dashboard/components/admin/admin-coming-soon-card";
import { AdminHeader } from "@/features/dashboard/components/admin/admin-header";
import { AdminKpiCards } from "@/features/dashboard/components/admin/admin-kpi-cards";
import { AdminNeedsAttention } from "@/features/dashboard/components/admin/admin-needs-attention";
import { AdminProfileCard } from "@/features/dashboard/components/admin/admin-profile-card";
import { AdminQuickActionsCard } from "@/features/dashboard/components/admin/admin-quick-actions-card";
import { DashboardTabStrip } from "@/features/dashboard/components/dashboard-tab-strip";
import { Explorer } from "@/features/dashboard/components/explorer";
import { MonthlyEarnedChart } from "@/features/dashboard/components/manager/monthly-earned-chart";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { Section, SectionError } from "@/features/dashboard/components/section";
import type { AdminDashboardData } from "@/features/dashboard/load";
import { buildExplorerTabs } from "@/features/dashboard/view-model";
import { RecordsRealtime } from "@/features/records/components/records-realtime";

function NoRecords() {
  return (
    <EmptyState
      title="No certificates yet"
      description="Add certificates and the statistics will appear here."
      action={
        <Link href="/records" className={buttonVariants()}>
          Go to certificates
        </Link>
      }
    />
  );
}

/**
 * Overview and Individual ranking span the full width; between them three independent columns flow on their own.
 * The centre column comes first in the markup so that on a phone the work leads; from lg up `lg:order-*` puts
 * it between the left and the right column.
 */
export function AdminDashboardView({
  greeting,
  subtitle,
  profile,
  profileError,
  kpis,
  certificates,
  teams,
  certTypes,
  providers,
  ranking,
  records,
  dqIssues,
}: AdminDashboardData) {
  const noRecords = kpis.ok && kpis.data.totalRecords === 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AdminHeader greeting={greeting} subtitle={subtitle} />
      <RecordsRealtime />

      {kpis.ok ? (
        <AdminKpiCards
          kpis={kpis.data}
          issuedThisMonth={records.ok ? countIssuedThisMonth(records.data) : undefined}
          completions={records.ok ? calculateCompletionKpis(records.data) : undefined}
          teams={teams}
        />
      ) : (
        <SectionError title="Overview" />
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12">
        <div data-testid="col-center" className="flex min-w-0 flex-col gap-6 lg:order-2 lg:col-span-6">
          <DashboardTabStrip label="Admin dashboard views" soon={["Approvals", "Goals", "Skills"]} />
          {noRecords ? (
            <NoRecords />
          ) : (
            <Section title="Explorer">
              <Explorer tabs={buildExplorerTabs({ teams, certTypes, providers, certificates })} defaultTab="team" />
            </Section>
          )}
        </div>

        <div data-testid="col-right" className="flex min-w-0 flex-col gap-6 lg:order-3 lg:col-span-3">
          {records.ok ? (
            <AdminNeedsAttention records={records.data} dqIssuesCount={dqIssues.ok ? dqIssues.data.length : undefined} />
          ) : (
            <SectionError title="Needs attention" />
          )}
          <AdminComingSoonCard />
        </div>

        <div data-testid="col-left" className="flex min-w-0 flex-col gap-6 lg:order-1 lg:col-span-3">
          {profileError ? <SectionError title="Your profile" /> : <AdminProfileCard profile={profile} />}
          <AdminQuickActionsCard />
          {records.ok ? <MonthlyEarnedChart records={records.data} /> : <SectionError title="Certificates earned" />}
        </div>
      </div>

      <Section
        title="Individual ranking"
        description="Ranked by valid certificates, then by total completed. Equal numbers share a rank."
      >
        {ranking.ok ? <RankingTable rows={ranking.data} /> : <SectionError title="Individual ranking" />}
      </Section>
    </div>
  );
}
