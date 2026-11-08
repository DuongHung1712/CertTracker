import { ExpiredCard } from "@/features/dashboard/components/admin/expired-card";
import { ExpiringCard } from "@/features/dashboard/components/admin/expiring-card";
import { StatStrip } from "@/features/dashboard/components/admin/stat-strip";
import { ValidCard } from "@/features/dashboard/components/admin/valid-card";
import { roundedShare, validCerts } from "@/features/dashboard/metrics";
import type { BreakdownRow, DashboardKpis } from "@/features/dashboard/schema";
import type { Result } from "@/lib/result";

export function AdminKpiCards({
  kpis,
  issuedThisMonth,
  teams,
}: {
  kpis: DashboardKpis;
  issuedThisMonth: number | undefined;
  teams: Result<BreakdownRow[]>;
}) {
  const valid = validCerts(kpis);
  const split = { urgent: kpis.expiringSoonCerts, soon: kpis.expiring60Certs, later: kpis.activeCerts };

  return (
    <section aria-label="Overview" className="flex flex-col gap-3">
      <h2 className="sr-only">Overview</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ValidCard
          valid={valid}
          completed={kpis.doneRecords}
          rate={roundedShare(valid, kpis.doneRecords)}
          issuedThisMonth={issuedThisMonth}
        />
        <ExpiringCard split={split} completed={kpis.doneRecords} />
        <ExpiredCard expired={kpis.expiredCerts} />
      </div>
      <StatStrip kpis={kpis} teams={teams} />
    </section>
  );
}
