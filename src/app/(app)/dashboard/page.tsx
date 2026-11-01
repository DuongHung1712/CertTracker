import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { KpiTile } from "@/components/data/kpi-tile";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { BreakdownTable } from "@/features/dashboard/components/breakdown-table";
import { ExpiryChart } from "@/features/dashboard/components/expiry-chart";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { Section, SectionError } from "@/features/dashboard/components/section";
import { expiringCerts, expiryBuckets, formatRate, ratePercent, validCerts } from "@/features/dashboard/metrics";
import { getBreakdown, getDashboardKpis, getRanking } from "@/features/dashboard/queries";
import { settle } from "@/features/dashboard/settle";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { formatDateTimeVn } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANKING_DESCRIPTION =
  "Ranked by valid certificates, then by total completed. Equal numbers share a rank.";
const MEMBER_EMPTY_HINT = "Not enough data to show (at least 3 learners are needed).";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const role = user?.role;
  // UX only — the SQL functions refuse/limit by role; this just avoids requesting and drawing what a Member cannot see.
  const canSeeTeams = role === "admin" || role === "manager";
  const isMember = role === "member";
  const emptyHint = isMember ? MEMBER_EMPTY_HINT : undefined;

  const [kpis, courses, teams, certTypes, providers, ranking] = await Promise.all([
    settle(getDashboardKpis()),
    settle(getBreakdown("course", 10)),
    canSeeTeams ? settle(getBreakdown("team")) : null,
    settle(getBreakdown("cert_type")),
    settle(getBreakdown("provider")),
    canSeeTeams ? settle(getRanking()) : null,
  ]);

  const noRecords = kpis.ok && kpis.data.totalRecords === 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Figures as of ${formatDateTimeVn(new Date().toISOString())}.`}
      />
      <RecordsRealtime />

      <Section title="Overview">
        {kpis.ok ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Active members" value={kpis.data.totalMembers} />
            <KpiTile label="Certificate records" value={kpis.data.totalRecords} />
            <KpiTile
              label="Completed"
              value={kpis.data.doneRecords}
              hint={`${formatRate(ratePercent(kpis.data.doneRecords, kpis.data.totalRecords))} of records`}
            />
            <KpiTile label="In progress" value={kpis.data.inProgressRecords} />
            <KpiTile
              label="Valid"
              value={validCerts(kpis.data)}
              hint={`Includes ${kpis.data.noExpiryCerts} with no expiry`}
            />
            <KpiTile label="Expiring (≤ 60 days)" value={expiringCerts(kpis.data)} />
            <KpiTile label="Expired" value={kpis.data.expiredCerts} />
          </dl>
        ) : (
          <SectionError title="Overview" />
        )}
      </Section>

      {noRecords ? (
        <EmptyState
          title="No certificates yet"
          description="Add certificates and the statistics will appear here."
          action={emptyAction(role, user?.memberId ?? null)}
        />
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Certificate expiry" description="Completed certificates, by time left">
              {kpis.ok ? <ExpiryChart buckets={expiryBuckets(kpis.data)} /> : <SectionError title="Certificate expiry" />}
            </Section>
            <Section title="Popular courses" description="The 10 courses with the most learners">
              {courses.ok ? (
                <BreakdownTable rows={courses.data} groupLabel="Course" peopleLabel="Learners" emptyHint={emptyHint} />
              ) : (
                <SectionError title="Popular courses" />
              )}
            </Section>
          </div>

          {teams && (
            <Section title="By team">
              {teams.ok ? (
                <BreakdownTable rows={teams.data} groupLabel="Team" peopleLabel="Members" />
              ) : (
                <SectionError title="By team" />
              )}
            </Section>
          )}

          <Section title="By certificate type">
            {certTypes.ok ? (
              <BreakdownTable
                rows={certTypes.data}
                groupLabel="Certificate type"
                peopleLabel="Learners"
                emptyHint={emptyHint}
              />
            ) : (
              <SectionError title="By certificate type" />
            )}
          </Section>

          <Section title="By provider">
            {providers.ok ? (
              <BreakdownTable
                rows={providers.data}
                groupLabel="Provider"
                peopleLabel="Learners"
                emptyHint={emptyHint}
              />
            ) : (
              <SectionError title="By provider" />
            )}
          </Section>

          {isMember && (
            <p className="text-caption text-muted-foreground">Only groups with at least 3 learners are shown.</p>
          )}
        </>
      )}

      {ranking && (
        <Section
          title="Individual ranking"
          description={role === "manager" ? `${RANKING_DESCRIPTION} Only members of the teams you manage are included.` : RANKING_DESCRIPTION}
        >
          {ranking.ok ? <RankingTable rows={ranking.data} /> : <SectionError title="Individual ranking" />}
        </Section>
      )}
    </div>
  );
}

function emptyAction(role: string | undefined, memberId: string | null) {
  if (role === "admin" || role === "manager") {
    return (
      <Link href="/records" className={cn(buttonVariants())}>
        Go to records
      </Link>
    );
  }
  if (role === "member" && memberId) {
    return (
      <Link href="/me" className={cn(buttonVariants())}>
        Go to my certificates
      </Link>
    );
  }
  return undefined;
}
