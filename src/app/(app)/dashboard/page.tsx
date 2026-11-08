import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Award, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { getMemberCareer } from "@/features/career/queries";
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
import { MemberDashboardView } from "@/features/dashboard/components/member/member-dashboard-view";
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
import { listMembers } from "@/features/members/queries";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { listCourseOptions, listRecords } from "@/features/records/queries";
import { formatDateTimeVn, formatNumber } from "@/lib/format";

const RANKING_DESCRIPTION =
  "Ranked by valid certificates, then by total completed. Equal numbers share a rank.";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const role = user.role;

  // Member Dashboard: Dedicated member home layout
  if (role === "member") {
    if (!user.memberId) {
      return (
        <div className="flex min-w-0 flex-col gap-6">
          <PageHeader title="Dashboard" description="Personal certificates and progress." />
          <EmptyState
            title="Your account is not linked to a member"
            description="Ask an admin to link your account to a member so your certificates show here."
          />
        </div>
      );
    }

    const [recordsResult, courseOptionsResult, careerResult, membersResult, kpisResult] = await Promise.all([
      settle(listRecords({ memberId: user.memberId })),
      settle(listCourseOptions()),
      settle(getMemberCareer(user.memberId)),
      settle(listMembers()),
      settle(getDashboardKpis()),
    ]);

    const memberObj = membersResult.ok ? membersResult.data.find((m) => m.id === user.memberId) : null;
    const firstRecord = recordsResult.ok ? recordsResult.data[0] : undefined;
    const fullName = memberObj?.fullName ?? firstRecord?.memberName ?? user.email;
    const teamName = memberObj?.teamName ?? firstRecord?.teamName ?? null;
    const careerRoleName =
      (careerResult.ok ? careerResult.data.careerRoleName : null) ?? memberObj?.careerRoleName ?? null;
    const yoeYears = (careerResult.ok ? careerResult.data.yoeYears : null) ?? memberObj?.yoeYears ?? null;

    return (
      <MemberDashboardView
        fullName={fullName}
        teamName={teamName}
        careerRoleName={careerRoleName}
        yoeYears={yoeYears}
        memberId={user.memberId}
        records={recordsResult.ok ? recordsResult.data : []}
        recordsError={!recordsResult.ok ? recordsResult.error : undefined}
        courseOptions={courseOptionsResult.ok ? courseOptionsResult.data : []}
        departmentKpis={kpisResult.ok ? kpisResult.data : null}
        departmentKpisError={!kpisResult.ok ? kpisResult.error : undefined}
      />
    );
  }

  // Admin and Manager Dashboard: byte-for-byte unaffected in behaviour
  const canSeeTeams = role === "admin" || role === "manager";
  const isMember = false;
  const emptyHint = undefined;

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
  const heroBreakdownResult = canSeeTeams ? teams : certTypes;
  const heroBreakdownRows = heroBreakdownResult?.ok ? heroBreakdownResult.data : [];

  // Build Explorer tabs
  const explorerTabs = [
    ...(canSeeTeams && teams
      ? [
          {
            id: "team",
            label: "By team",
            groupLabel: "Team",
            peopleLabel: "Members",
            result: teams,
            emptyHint,
          },
        ]
      : []),
    {
      id: "cert_type",
      label: "By certificate type",
      groupLabel: "Certificate type",
      peopleLabel: "Learners",
      result: certTypes,
      emptyHint,
    },
    {
      id: "provider",
      label: "By provider",
      groupLabel: "Provider",
      peopleLabel: "Learners",
      result: providers,
      emptyHint,
    },
    {
      id: "course",
      label: "Popular courses",
      groupLabel: "Course",
      peopleLabel: "Learners",
      result: courses,
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
                visual={
                  heroBreakdownResult && !heroBreakdownResult.ok ? (
                    <div
                      role="alert"
                      className="flex h-24 flex-col items-center justify-center gap-1 rounded border border-destructive/20 bg-destructive/5 px-2 text-center text-caption text-destructive"
                    >
                      <p className="font-medium">Could not load chart.</p>
                    </div>
                  ) : (
                    <RecordsMiniChart
                      rows={heroBreakdownRows}
                      totalRecords={kpis.data.totalRecords}
                    />
                  )
                }
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
                  kpis.data.expiredCerts > 0 && heroBreakdownResult && !heroBreakdownResult.ok ? (
                    <div
                      role="alert"
                      className="flex h-24 flex-col items-center justify-center gap-1 rounded border border-destructive/20 bg-destructive/5 px-2 text-center text-caption text-destructive"
                    >
                      <p className="font-medium">Could not load chart.</p>
                    </div>
                  ) : (
                    <ExpiredMiniChart
                      totalExpired={kpis.data.expiredCerts}
                      rows={heroBreakdownRows}
                    />
                  )
                }
              />
            </dl>

            {/* Slim compact stat strip: 3 inline stats replacing large separate boxes */}
            <dl className="grid grid-cols-1 divide-y divide-border rounded-lg border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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
            <div className="rounded-lg border border-border bg-card p-3.5">
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
      <Link href="/records" className={buttonVariants()}>
        Go to records
      </Link>
    );
  }
  if (role === "member" && memberId) {
    return (
      <Link href="/me" className={buttonVariants()}>
        Go to my certificates
      </Link>
    );
  }
  return undefined;
}
