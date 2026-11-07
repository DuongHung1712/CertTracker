import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { KpiTile } from "@/components/data/kpi-tile";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { CompletionDonut } from "@/features/dashboard/components/completion-donut";
import { ExpiryChart } from "@/features/dashboard/components/expiry-chart";
import { Explorer } from "@/features/dashboard/components/explorer";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { RankingTable } from "@/features/dashboard/components/ranking-table";
import { Section, SectionError } from "@/features/dashboard/components/section";
import { StatusBar } from "@/features/dashboard/components/status-bar";
import {
  expiringBuckets,
  expiringCerts,
  expiryBuckets,
  formatRate,
  kpiStudyStatusSplit,
  ratePercent,
  validBuckets,
  validCerts,
} from "@/features/dashboard/metrics";
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
        actions={
          <Link
            href={isMember ? "/me" : "/records"}
            className={cn(buttonVariants(), "min-h-[44px] sm:min-h-[36px]")}
          >
            {isMember ? "My certificates" : "View records"}
          </Link>
        }
      />
      <RecordsRealtime />

      {/* 2. Overview: Hero row (4 cards) + Compact row (3 tiles) */}
      <Section title="Overview">
        {kpis.ok ? (
          <div className="flex flex-col gap-3">
            {/* Hero row: 4 cards with visuals below dd */}
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Certificate records"
                value={kpis.data.totalRecords}
                visual={
                  <StatusBar
                    segments={kpiStudyStatusSplit(kpis.data)}
                    ariaLabel="Study status breakdown"
                  />
                }
              />
              <KpiCard
                label="Valid"
                value={validCerts(kpis.data)}
                hint={`Includes ${kpis.data.noExpiryCerts} with no expiry`}
                visual={
                  <StatusBar
                    segments={validBuckets(kpis.data)}
                    ariaLabel="Valid certificates breakdown"
                  />
                }
              />
              <KpiCard
                label="Expiring (≤ 60 days)"
                value={expiringCerts(kpis.data)}
                hint="31–60 days vs ≤ 30 days left"
                visual={
                  <StatusBar
                    segments={expiringBuckets(kpis.data)}
                    ariaLabel="Expiring certificates breakdown"
                  />
                }
              />
              <KpiCard
                label="Expired"
                value={kpis.data.expiredCerts}
                hint="Completed certificates past their expiry date"
                valueClassName={kpis.data.expiredCerts > 0 ? "text-destructive" : undefined}
                visual={
                  <StatusBar
                    segments={[
                      {
                        key: "expired",
                        label: "Expired",
                        count: kpis.data.expiredCerts,
                        color: "var(--status-expired-fg)",
                      },
                    ]}
                    ariaLabel="Expired certificates count"
                  />
                }
              />
            </dl>

            {/* Compact row: 3 tiles */}
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiTile label="Active members" value={kpis.data.totalMembers} />
              <KpiTile
                label="Completed"
                value={kpis.data.doneRecords}
                hint={`${formatRate(ratePercent(kpis.data.doneRecords, kpis.data.totalRecords))} of records`}
              />
              <KpiTile label="In progress" value={kpis.data.inProgressRecords} />
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
          {/* 3. Health row: 2/3 ExpiryChart + 1/3 CompletionDonut */}
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Section title="Certificate expiry" description="Completed certificates, by time left">
                {kpis.ok ? (
                  <ExpiryChart buckets={expiryBuckets(kpis.data)} />
                ) : (
                  <SectionError title="Certificate expiry" />
                )}
              </Section>
            </div>
            <div className="lg:col-span-1">
              <Section title="Completion" description="Study status of all records">
                {kpis.ok ? (
                  <CompletionDonut
                    counts={{
                      done: kpis.data.doneRecords,
                      inProgress: kpis.data.inProgressRecords,
                      notStarted: kpis.data.notStartedRecords,
                    }}
                  />
                ) : (
                  <SectionError title="Completion" />
                )}
              </Section>
            </div>
          </div>

          {/* 4. Explorer: Tabbed selector with compact list & detail panel */}
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
