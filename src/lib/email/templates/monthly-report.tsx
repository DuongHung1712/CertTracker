import { Heading, Text } from "@react-email/components";
import { formatRate } from "@/features/dashboard/metrics";
import type { Kpi, MonthlyReport } from "@/features/notifications/monthly-plan";
import { monthLabel } from "@/features/notifications/period";
import { formatNumber } from "@/lib/format";
import { EMAIL_THEME as c } from "@/lib/email/theme";
import { appLink, EmailLayout, ExpiryTable, styles } from "@/lib/email/templates/layout";
import type { CSSProperties } from "react";

const num: CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };

/** Labels match the Dashboard KPI tiles word for word (decisions #31). */
function kpiRows(k: Kpi): Array<[label: string, value: string]> {
  return [
    ["Thành viên", formatNumber(k.members)],
    ["Bản ghi", formatNumber(k.records)],
    ["Hoàn thành", `${formatNumber(k.done)} (${formatRate(k.completionRate)})`],
    ["Đang học", formatNumber(k.inProgress)],
    ["Còn hiệu lực", formatNumber(k.valid)],
    ["Sắp hết hạn (≤ 60 ngày)", formatNumber(k.expiring)],
    ["Đã hết hạn", formatNumber(k.expired)],
    ["Cấp mới trong tháng", formatNumber(k.issuedInMonth)],
    ["Hết hạn trong tháng", formatNumber(k.expiredInMonth)],
  ];
}

/** Every user-controlled string below goes through JSX text, so React escapes it. */
export function MonthlyReportEmail({ report, appUrl }: { report: MonthlyReport; appUrl: string | null }) {
  const title = `Báo cáo ${monthLabel(report.month)}`;
  return (
    <EmailLayout preview={title} appUrl={appUrl}>
      <Text style={styles.text}>{report.name ? `Xin chào ${report.name}` : "Xin chào"}</Text>
      <Heading as="h2" style={{ ...styles.h2, marginTop: 8 }}>
        {title}
      </Heading>
      <Text style={styles.muted}>{report.scope === "teams" ? "Số liệu của các team bạn quản lý." : "Số liệu toàn đơn vị."}</Text>

      <table role="presentation" cellPadding={0} cellSpacing={0} style={styles.table}>
        <tbody>
          {kpiRows(report.overall).map(([label, value]) => (
            <tr key={label}>
              <td style={styles.td}>{label}</td>
              <td style={{ ...styles.td, ...num, fontWeight: 700 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {report.teams.length > 0 ? (
        <>
          <Heading as="h2" style={styles.h2}>
            Theo team
          </Heading>
          <table role="presentation" cellPadding={0} cellSpacing={0} style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Team</th>
                <th style={{ ...styles.th, ...num }}>Thành viên</th>
                <th style={{ ...styles.th, ...num }}>Hoàn thành</th>
                <th style={{ ...styles.th, ...num }}>Còn hiệu lực</th>
                <th style={{ ...styles.th, ...num }}>Sắp hết hạn</th>
                <th style={{ ...styles.th, ...num }}>Đã hết hạn</th>
              </tr>
            </thead>
            <tbody>
              {report.teams.map((t) => (
                <tr key={t.teamId ?? "no-team"}>
                  <td style={styles.td}>{t.teamName}</td>
                  <td style={{ ...styles.td, ...num }}>{formatNumber(t.kpi.members)}</td>
                  <td style={{ ...styles.td, ...num }}>{formatRate(t.kpi.completionRate)}</td>
                  <td style={{ ...styles.td, ...num }}>{formatNumber(t.kpi.valid)}</td>
                  <td style={{ ...styles.td, ...num }}>{formatNumber(t.kpi.expiring)}</td>
                  <td style={{ ...styles.td, ...num, color: t.kpi.expired > 0 ? c.expiredFg : c.foreground }}>
                    {formatNumber(t.kpi.expired)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {report.upcoming.length > 0 ? (
        <>
          <Heading as="h2" style={styles.h2}>
            Sắp hết hạn trong 60 ngày
          </Heading>
          <ExpiryTable items={report.upcoming} withMember moreHref={appLink(appUrl, "/records")} />
        </>
      ) : null}
    </EmailLayout>
  );
}
