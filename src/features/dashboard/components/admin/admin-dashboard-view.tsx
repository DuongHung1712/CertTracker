import Link from "next/link";
import { UserGuideCard, type UserGuideProps } from "@/features/guide/components/user-guide-card";
import { EmptyState } from "@/components/data/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { AdminHeader } from "@/features/dashboard/components/admin/admin-header";
import { AdminNeedsAttention } from "@/features/dashboard/components/admin/admin-needs-attention";
import { Explorer } from "@/features/dashboard/components/explorer";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { Section, SectionError } from "@/features/dashboard/components/section";
import { SummaryTile } from "@/features/dashboard/components/summary-tile";
import { WaitingTile } from "@/features/dashboard/components/waiting-tile";
import type { AdminDashboardData } from "@/features/dashboard/load";
import { examDoneCerts, expiringCerts, roundedShare, validCerts } from "@/features/dashboard/metrics";
import { buildExplorerTabs } from "@/features/dashboard/view-model";
import { isProposal } from "@/features/data-quality/issues";
import { pluralize } from "@/lib/plural";
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
 * What an admin does here: approve, renew and fix. Four numbers, one list of what needs attention, and the Explorer to dig into
 * a team, a certificate type, a provider or a certificate. The individual ranking is one click away at the bottom.
 */
export function AdminDashboardView({ greeting, subtitle, kpis, certificates, teams, certTypes, providers, ranking, records, dqIssues, learningError, guide }: AdminDashboardData & { guide?: UserGuideProps }) {
  const noRecords = kpis.ok && kpis.data.totalRecords === 0;
  const proposalCount = dqIssues.ok ? dqIssues.data.filter((issue) => isProposal(issue.type)).length : 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AdminHeader greeting={greeting} subtitle={subtitle} showFilterButton={!noRecords} />
      {guide && <UserGuideCard {...guide} />}
      <RecordsRealtime />

      {learningError && (
        <Alert variant="destructive">
          <AlertTitle>Learning items could not be loaded</AlertTitle>
          <AlertDescription>Planned and in-progress items may be missing. Reload the page to try again.</AlertDescription>
        </Alert>
      )}

      <section aria-label="Overview" className="flex flex-col gap-3">
        <h2 className="sr-only">Overview</h2>
        {kpis.ok ? (
          <Tiles kpis={kpis.data} />
        ) : (
          <SectionError title="Overview" />
        )}
      </section>

      {records.ok ? (
        <AdminNeedsAttention
          records={records.data}
          dqIssuesCount={dqIssues.ok ? dqIssues.data.filter((issue) => !isProposal(issue.type)).length : undefined}
          proposalCount={proposalCount}
        />
      ) : (
        <SectionError title="Needs attention" />
      )}

      {noRecords ? (
        <NoRecords />
      ) : (
        <Section title="Explorer">
          <Explorer tabs={buildExplorerTabs({ teams, certTypes, providers, certificates })} defaultTab="team" />
        </Section>
      )}

      <details className="group rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer"><h2 className="inline text-section-title font-semibold text-foreground">Individual ranking</h2></summary>
        <p className="mt-1 text-caption text-muted-foreground">Ranked by valid certificates, then by total completed. Equal numbers share a rank.</p>
        <div className="mt-3">{ranking.ok ? <RankingTable rows={ranking.data} /> : <SectionError title="Individual ranking" />}</div>
      </details>
    </div>
  );
}

function Tiles({ kpis }: { kpis: Extract<AdminDashboardData["kpis"], { ok: true }>["data"] }) {
  const valid = validCerts(kpis);
  const examDone = examDoneCerts(kpis);
  const expiring = expiringCerts(kpis);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* An admin approves too: this tile stays the way in. Catalogue proposals are a row under Needs attention. */}
      <WaitingTile count={kpis.waitingRecords} />
      <SummaryTile
        label="Valid certificates"
        value={valid}
        summary={examDone === 0 ? "No completed certificates yet" : `of ${examDone} completed · ${roundedShare(valid, examDone)}%`}
        footer={pluralize(kpis.totalMembers, "active member")}
      />
      <SummaryTile
        label="Expiring in 60 days"
        value={expiring}
        summary={expiring === 0 ? "Nothing expiring soon" : `${kpis.expiringSoonCerts} within 30 days`}
        footer="Within 30 days: see Needs attention"
        tone={kpis.expiringSoonCerts > 0 ? "warning" : "neutral"}
      />
      <SummaryTile
        label="Expired"
        value={kpis.expiredCerts}
        summary={kpis.expiredCerts === 0 ? "Nothing has expired" : "Past the expiry date"}
        footer={kpis.expiredCerts === 0 ? "All up to date" : "Members need to renew these"}
        tone={kpis.expiredCerts > 0 ? "danger" : "neutral"}
      />
    </div>
  );
}
