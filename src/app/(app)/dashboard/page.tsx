import Link from "next/link";
import { AlertCircle, Award, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { ExpiryChart } from "@/features/dashboard/components/expiry-chart";
import { Explorer } from "@/features/dashboard/components/explorer";
import { DashboardHeaderActions } from "@/features/dashboard/components/header-actions";
import {
  ExpiredMiniChart,
  ExpiringGaugeMiniChart,
  RecordsMiniChart,
  ValidMiniChart,
} from "@/features/dashboard/components/hero-charts";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { Section, SectionError } from "@/features/dashboard/components/section";
import {
  expiringCerts,
  expiryBuckets,
  formatRate,
  ratePercent,
  validBuckets,
  validCerts,
} from "@/features/dashboard/metrics";
import { getBreakdown, getDashboardKpis, getRanking } from "@/features/dashboard/queries";
import { settle } from "@/features/dashboard/settle";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { formatDateTimeVn, formatNumber } from "@/lib/format";
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

  // Breakdown rows used for hero chart dimensions
  const breakdownForHero = canSeeTeams && teams?.ok
    ? teams.data
    : certTypes.ok
      ? certTypes.data
      : [];

  // Build Explorer tabs
  const explorerTabs = [
    ...(canSeeTeams && teams
      ? [
          {
            id: "team",
            label: "By team",
            groupLabel: "Team",
            peopleLabel: "Members",
            rows: teams.ok ? teams.data : [],
            emptyHint,
          },
        ]
      : []),
    {
      id: "cert_type",
      label: "By certificate type",
      groupLabel: "Certificate type",
      peopleLabel: "Learners",
      rows: certTypes.ok ? certTypes.data : [],
      emptyHint,
    },
    {
      id: "provider",
      label: "By provider",
      groupLabel: "Provider",
      peopleLabel: "Learners",
      rows: providers.ok ? providers.data : [],
      emptyHint,
    },
    {
      id: "course",
      label: "Popular courses",
      groupLabel: "Course",
      peopleLabel: "Learners",
      rows: courses.ok ? courses.data : [],
      emptyHint,
    },
  ];

  const defaultTab = canSeeTeams ? "team" : "cert_type";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Figures as of ${formatDateTimeVn(new Date().toISOString())}.`}
        actions={<DashboardHeaderActions isMember={isMember} />}
      />
      <RecordsRealtime />

      {/* 2. Overview: Hero row (4 tall cards with mini charts) + Slim stat strip (3 stats) */}
      <Section title="Overview">
        {kpis.ok ? (
          <div className="flex flex-col gap-3.5">
            {/* Hero row: 4 tall cards with real mini charts filling the lower half */}
            <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Certificate records"
                value={kpis.data.totalRecords}
                icon={<Award className="size-4 text-foreground" />}
                hint="Total tracked across teams"
                visual={<RecordsMiniChart rows={breakdownForHero} />}
              />
              <KpiCard
                label="Valid"
                value={validCerts(kpis.data)}
                icon={<CheckCircle2 className="size-4 text-[var(--status-active-fg)]" />}
                hint={`Includes ${kpis.data.noExpiryCerts} with no expiry`}
                visual={<ValidMiniChart buckets={validBuckets(kpis.data)} />}
              />
              <KpiCard
                label="Expiring (≤ 60 days)"
                value={expiringCerts(kpis.data)}
                icon={<Clock className="size-4 text-[var(--status-expiring-soon-fg)]" />}
                hint="31–60 days vs ≤ 30 days left"
                visual={
                  <ExpiringGaugeMiniChart
                    expiringCount={expiringCerts(kpis.data)}
                    totalCompleted={kpis.data.doneRecords}
                  />
                }
              />
              <KpiCard
                label="Expired"
                value={kpis.data.expiredCerts}
                icon={<AlertCircle className="size-4 text-destructive" />}
                hint="Completed certificates past their expiry date"
                valueClassName={kpis.data.expiredCerts > 0 ? "text-destructive font-semibold" : undefined}
                visual={
                  <ExpiredMiniChart
                    totalExpired={kpis.data.expiredCerts}
                    rows={breakdownForHero}
                  />
                }
              />
            </dl>

            {/* Slim compact stat strip: 3 inline stats replacing large separate boxes */}
            <dl className="grid grid-cols-1 divide-y divide-border rounded-lg border border-border bg-card shadow-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="flex items-center justify-between px-4 py-3 sm:flex-col sm:items-start sm:gap-0.5">
                <dt className="text-label uppercase tracking-wider text-muted-foreground">Active members</dt>
                <dd className="text-xl font-semibold tabular-nums text-foreground">
                  {formatNumber(kpis.data.totalMembers)}
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 sm:flex-col sm:items-start sm:gap-0.5">
                <dt className="text-label uppercase tracking-wider text-muted-foreground">Completed</dt>
                <dd className="text-xl font-semibold tabular-nums text-foreground">
                  {formatNumber(kpis.data.doneRecords)}
                </dd>
                <dd className="text-caption text-muted-foreground">
                  {formatRate(ratePercent(kpis.data.doneRecords, kpis.data.totalRecords))} of records
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 sm:flex-col sm:items-start sm:gap-0.5">
                <dt className="text-label uppercase tracking-wider text-muted-foreground">In progress</dt>
                <dd className="text-xl font-semibold tabular-nums text-foreground">
                  {formatNumber(kpis.data.inProgressRecords)}
                </dd>
              </div>
            </dl>
          </div>
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
          {/* 3. Certificate expiry: Compact horizontal strip sitting directly above Explorer */}
          <Section title="Certificate expiry" description="Completed certificates, by time left">
            <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
              {kpis.ok ? (
                <ExpiryChart buckets={expiryBuckets(kpis.data)} compact />
              ) : (
                <SectionError title="Certificate expiry" />
              )}
            </div>
          </Section>

          {/* 4. Explorer: Filter Row + Centerpiece Master-Detail board matching the template */}
          <Section title="Explorer" description="Breakdown by team, certificate type, provider or course">
            {explorerTabs.length > 0 ? (
              <Explorer tabs={explorerTabs} defaultTab={defaultTab} />
            ) : (
              <SectionError title="Explorer" />
            )}
          </Section>

          {isMember && (
            <p className="text-caption text-muted-foreground">
              Only groups with at least 3 learners are shown.
            </p>
          )}
        </>
      )}

      {/* 5. Individual ranking */}
      {ranking && (
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
      )}
    </div>
  );
}

function emptyAction(role: string | undefined, memberId: string | null) {
  if (role === "admin" || role === "manager") {
    return (
      <Link href="/records" className={cn(buttonVariants(), "min-h-[44px] sm:min-h-[36px]")}>
        Go to records
      </Link>
    );
  }
  if (role === "member" && memberId) {
    return (
      <Link href="/me" className={cn(buttonVariants(), "min-h-[44px] sm:min-h-[36px]")}>
        Go to my certificates
      </Link>
    );
  }
  return undefined;
}
