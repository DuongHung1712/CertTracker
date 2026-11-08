import { AlertCircle, Award, CheckCircle2, Clock } from "lucide-react";
import { ChartLoadError } from "@/features/dashboard/components/chart-load-error";
import {
  ExpiredMiniChart,
  ExpiringGaugeMiniChart,
  RecordsMiniChart,
  ValidMiniChart,
} from "@/features/dashboard/components/hero-charts";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { Section, SectionError } from "@/features/dashboard/components/section";
import { expiringCerts, formatRate, ratePercent, validBuckets, validCerts } from "@/features/dashboard/metrics";
import type { BreakdownRow, DashboardKpis } from "@/features/dashboard/schema";
import { formatNumber } from "@/lib/format";
import type { Result } from "@/lib/result";

export function OverviewSection({
  kpis,
  heroBreakdown,
}: {
  kpis: Result<DashboardKpis>;
  heroBreakdown: Result<BreakdownRow[]>;
}) {
  if (!kpis.ok) {
    return (
      <Section title="Overview">
        <SectionError title="Overview" />
      </Section>
    );
  }
  const k = kpis.data;
  const heroRows = heroBreakdown.ok ? heroBreakdown.data : [];

  return (
    <Section title="Overview">
      <div className="flex flex-col gap-3.5">
        <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Certificates"
            value={k.totalRecords}
            icon={<Award className="size-4 text-foreground" />}
            hint="Total tracked across teams"
            visual={
              heroBreakdown.ok ? <RecordsMiniChart rows={heroRows} totalRecords={k.totalRecords} /> : <ChartLoadError />
            }
          />
          <KpiCard
            label="Valid"
            value={validCerts(k)}
            icon={<CheckCircle2 className="size-4 text-[var(--status-active-fg)]" />}
            hint={`Includes ${k.noExpiryCerts} with no expiry`}
            visual={<ValidMiniChart buckets={validBuckets(k)} />}
          />
          <KpiCard
            label="Expiring within 60 days"
            value={expiringCerts(k)}
            icon={<Clock className="size-4 text-[var(--status-expiring-soon-fg)]" />}
            hint="Valid, 60 days or less left"
            visual={<ExpiringGaugeMiniChart expiringCount={expiringCerts(k)} totalCompleted={k.doneRecords} />}
          />
          <KpiCard
            label="Expired"
            value={k.expiredCerts}
            icon={<AlertCircle className="size-4 text-destructive" />}
            hint="Completed certificates past their expiry date"
            valueClassName={k.expiredCerts > 0 ? "text-destructive font-semibold" : undefined}
            visual={
              k.expiredCerts > 0 && !heroBreakdown.ok ? (
                <ChartLoadError />
              ) : (
                <ExpiredMiniChart totalExpired={k.expiredCerts} rows={heroRows} />
              )
            }
          />
        </dl>

        <dl className="grid grid-cols-1 divide-y divide-border rounded-lg border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <StatStripItem label="Active members" value={formatNumber(k.totalMembers)} />
          <StatStripItem
            label="Completed"
            value={formatNumber(k.doneRecords)}
            caption={`${formatRate(ratePercent(k.doneRecords, k.totalRecords))} of all certificates`}
          />
          <StatStripItem label="In progress" value={formatNumber(k.inProgressRecords)} />
        </dl>
      </div>
    </Section>
  );
}

function StatStripItem({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 sm:flex-col sm:items-start sm:gap-0.5">
      <dt className="text-label uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums text-foreground">{value}</dd>
      {caption && <dd className="text-caption text-muted-foreground">{caption}</dd>}
    </div>
  );
}
