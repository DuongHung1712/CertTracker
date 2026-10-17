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
  "Xếp theo số chứng chỉ còn hiệu lực, rồi tổng số đã hoàn thành. Cùng số liệu thì cùng hạng.";
const MEMBER_EMPTY_HINT = "Chưa đủ dữ liệu để hiển thị (cần từ 3 người học trở lên).";

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
        description={`Số liệu tính đến ${formatDateTimeVn(new Date().toISOString())}.`}
      />
      <RecordsRealtime />

      <Section title="Tổng quan">
        {kpis.ok ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Thành viên đang hoạt động" value={kpis.data.totalMembers} />
            <KpiTile label="Bản ghi chứng chỉ" value={kpis.data.totalRecords} />
            <KpiTile
              label="Hoàn thành"
              value={kpis.data.doneRecords}
              hint={`${formatRate(ratePercent(kpis.data.doneRecords, kpis.data.totalRecords))} số bản ghi`}
            />
            <KpiTile label="Đang học" value={kpis.data.inProgressRecords} />
            <KpiTile
              label="Còn hiệu lực"
              value={validCerts(kpis.data)}
              hint={`Gồm ${kpis.data.noExpiryCerts} không thời hạn`}
            />
            <KpiTile label="Sắp hết hạn (≤ 60 ngày)" value={expiringCerts(kpis.data)} />
            <KpiTile label="Đã hết hạn" value={kpis.data.expiredCerts} />
          </dl>
        ) : (
          <SectionError title="Tổng quan" />
        )}
      </Section>

      {noRecords ? (
        <EmptyState
          title="Chưa có chứng chỉ nào"
          description="Thêm chứng chỉ để thống kê xuất hiện ở đây."
          action={emptyAction(role, user?.memberId ?? null)}
        />
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Hạn chứng chỉ" description="Chứng chỉ đã hoàn thành, theo thời hạn">
              {kpis.ok ? <ExpiryChart buckets={expiryBuckets(kpis.data)} /> : <SectionError title="Hạn chứng chỉ" />}
            </Section>
            <Section title="Khóa học phổ biến" description="10 khóa học có nhiều người học nhất">
              {courses.ok ? (
                <BreakdownTable rows={courses.data} groupLabel="Khóa học" peopleLabel="Người học" emptyHint={emptyHint} />
              ) : (
                <SectionError title="Khóa học phổ biến" />
              )}
            </Section>
          </div>

          {teams && (
            <Section title="Theo team">
              {teams.ok ? (
                <BreakdownTable rows={teams.data} groupLabel="Team" peopleLabel="Thành viên" />
              ) : (
                <SectionError title="Theo team" />
              )}
            </Section>
          )}

          <Section title="Theo loại chứng chỉ">
            {certTypes.ok ? (
              <BreakdownTable
                rows={certTypes.data}
                groupLabel="Loại chứng chỉ"
                peopleLabel="Người học"
                emptyHint={emptyHint}
              />
            ) : (
              <SectionError title="Theo loại chứng chỉ" />
            )}
          </Section>

          <Section title="Theo nhà cung cấp">
            {providers.ok ? (
              <BreakdownTable
                rows={providers.data}
                groupLabel="Nhà cung cấp"
                peopleLabel="Người học"
                emptyHint={emptyHint}
              />
            ) : (
              <SectionError title="Theo nhà cung cấp" />
            )}
          </Section>

          {isMember && (
            <p className="text-caption text-muted-foreground">Chỉ hiển thị nhóm có từ 3 người học trở lên.</p>
          )}
        </>
      )}

      {ranking && (
        <Section
          title="Xếp hạng cá nhân"
          description={role === "manager" ? `${RANKING_DESCRIPTION} Chỉ gồm thành viên trong team bạn quản lý.` : RANKING_DESCRIPTION}
        >
          {ranking.ok ? <RankingTable rows={ranking.data} /> : <SectionError title="Xếp hạng cá nhân" />}
        </Section>
      )}
    </div>
  );
}

function emptyAction(role: string | undefined, memberId: string | null) {
  if (role === "admin" || role === "manager") {
    return (
      <Link href="/records" className={cn(buttonVariants())}>
        Đi tới chứng chỉ
      </Link>
    );
  }
  if (role === "member" && memberId) {
    return (
      <Link href="/me" className={cn(buttonVariants())}>
        Đi tới chứng chỉ của tôi
      </Link>
    );
  }
  return undefined;
}
