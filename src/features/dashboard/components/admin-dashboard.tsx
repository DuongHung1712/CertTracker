import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import type { Role } from "@/components/status/labels";
import { buttonVariants } from "@/components/ui/button";
import { ExpiryChart } from "@/features/dashboard/components/expiry-chart";
import { Explorer } from "@/features/dashboard/components/explorer";
import { DashboardHeaderActions } from "@/features/dashboard/components/header-actions";
import { OverviewSection } from "@/features/dashboard/components/overview-section";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { Section, SectionError } from "@/features/dashboard/components/section";
import type { AdminDashboardData } from "@/features/dashboard/load";
import { expiryBuckets } from "@/features/dashboard/metrics";
import { buildExplorerTabs } from "@/features/dashboard/view-model";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { formatDateTimeVn } from "@/lib/format";

const RANKING_DESCRIPTION =
  "Ranked by valid certificates, then by total completed. Equal numbers share a rank.";

/** The admin and manager dashboard; a member's own dashboard is `MemberDashboardView`. */
export function AdminDashboard({ role, data }: { role: Exclude<Role, "member">; data: AdminDashboardData }) {
  const { kpis, courses, teams, certTypes, providers, ranking } = data;
  const noRecords = kpis.ok && kpis.data.totalRecords === 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Figures as of ${formatDateTimeVn(new Date().toISOString())}.`}
        actions={<DashboardHeaderActions />}
      />
      <RecordsRealtime />

      <OverviewSection kpis={kpis} heroBreakdown={teams} />

      {noRecords ? (
        <EmptyState
          title="No certificates yet"
          description="Add certificates and the statistics will appear here."
          action={
            <Link href="/records" className={buttonVariants()}>
              Go to certificates
            </Link>
          }
        />
      ) : (
        <>
          <Section title="Certificate expiry" description="Completed certificates, by time left">
            <div className="rounded-lg border border-border bg-card p-3.5">
              {kpis.ok ? (
                <ExpiryChart buckets={expiryBuckets(kpis.data)} compact />
              ) : (
                <SectionError title="Certificate expiry" />
              )}
            </div>
          </Section>

          <Section title="Explorer" description="Breakdown by team, certificate type, provider or course">
            <Explorer tabs={buildExplorerTabs({ teams, certTypes, providers, courses })} defaultTab="team" />
          </Section>
        </>
      )}

      <Section
        title="Individual ranking"
        description={
          role === "manager"
            ? `${RANKING_DESCRIPTION} Only members of the teams you manage are included.`
            : RANKING_DESCRIPTION
        }
      >
        {ranking.ok ? <RankingTable rows={ranking.data} /> : <SectionError title="Individual ranking" />}
      </Section>
    </div>
  );
}
