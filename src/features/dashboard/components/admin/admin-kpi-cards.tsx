import { ExpiredCard } from "@/features/dashboard/components/admin/expired-card";
import { ExpiringCard } from "@/features/dashboard/components/admin/expiring-card";
import { TeamCountsSummary } from "@/features/dashboard/components/admin/team-counts-summary";
import { ValidCard } from "@/features/dashboard/components/admin/valid-card";
import { KpiGroup } from "@/features/dashboard/components/kpi-group";
import { StatStrip } from "@/features/dashboard/components/stat-strip";
import type { CompletionKpis } from "@/features/dashboard/completion-metrics";
import { examDoneCerts, roundedShare, validCerts } from "@/features/dashboard/metrics";
import type { BreakdownRow, DashboardKpis } from "@/features/dashboard/schema";
import type { Result } from "@/lib/result";

export function AdminKpiCards({
  kpis,
  issuedThisMonth,
  completions,
  teams,
}: {
  kpis: DashboardKpis;
  /** Both are undefined when the certificate list failed to load: those figures are then left out. */
  issuedThisMonth: number | undefined;
  completions: CompletionKpis | undefined;
  teams: Result<BreakdownRow[]>;
}) {
  const valid = validCerts(kpis);
  const examDone = examDoneCerts(kpis);
  const split = { urgent: kpis.expiringSoonCerts, soon: kpis.expiring60Certs, later: kpis.activeCerts };

  return (
    <section aria-label="Overview" className="flex flex-col gap-6">
      <h2 className="sr-only">Overview</h2>
      <KpiGroup title="Exam certificates">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ValidCard
            valid={valid}
            completed={examDone}
            rate={roundedShare(valid, examDone)}
            issuedThisMonth={issuedThisMonth}
          />
          <ExpiringCard split={split} completed={examDone} />
          <ExpiredCard expired={kpis.expiredCerts} />
        </div>
        <StatStrip
          stats={[
            ["Active members", kpis.totalMembers],
            ["Completed", examDone],
            ["In progress", kpis.inProgressRecords - kpis.completionInProgressRecords],
          ]}
        />
        <TeamCountsSummary teams={teams} />
      </KpiGroup>
      <KpiGroup title="Course completions">
        <StatStrip
          stats={[
            ["Completed this month", completions?.doneThisMonth],
            ["Completed this quarter", completions?.doneThisQuarter],
            ["Completions in progress", kpis.completionInProgressRecords],
          ]}
        />
      </KpiGroup>
    </section>
  );
}
