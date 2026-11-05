import { Heading, Text } from "@react-email/components";
import { formatRate } from "@/features/dashboard/metrics";
import type { Kpi, MonthlyReport } from "@/features/notifications/monthly-plan";
import { monthLabel } from "@/features/notifications/period";
import { formatDate, formatNumber } from "@/lib/format";
import { EMAIL_THEME as c } from "@/lib/email/theme";
import { appLink, EmailLayout, ExpiryTable, styles } from "@/lib/email/templates/layout";
import type { CSSProperties } from "react";

const num: CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };

/** Labels match the Dashboard KPI tiles word for word (decisions #31). */
function kpiRows(k: Kpi): Array<[label: string, value: string]> {
  return [
    ["Active members", formatNumber(k.members)],
    ["Certificate records", formatNumber(k.records)],
    ["Completed", `${formatNumber(k.done)} (${formatRate(k.completionRate)})`],
    ["In progress", formatNumber(k.inProgress)],
    ["Valid", formatNumber(k.valid)],
    ["Expiring (≤ 60 days)", formatNumber(k.expiring)],
    ["Expired", formatNumber(k.expired)],
    ["Issued this month", formatNumber(k.issuedInMonth)],
    ["Expired this month", formatNumber(k.expiredInMonth)],
  ];
}

/** Every user-controlled string below goes through JSX text, so React escapes it. */
/** `asOf` is the Vietnam date the figures were computed on: KPIs are a snapshot of now, not of the end of the month. */
export function MonthlyReportEmail({ report, appUrl, asOf }: { report: MonthlyReport; appUrl: string | null; asOf: string }) {
  const title = `Monthly report for ${monthLabel(report.month)}`;
  return (
    <EmailLayout preview={title} appUrl={appUrl}>
      <Text style={styles.text}>{report.name ? `Hello ${report.name},` : "Hello,"}</Text>
      <Heading as="h2" style={{ ...styles.h2, marginTop: 8 }}>
        {title}
      </Heading>
      <Text style={styles.muted}>{report.scope === "teams" ? "Figures for the teams you manage." : "Figures for the whole organisation."}</Text>
      <Text style={styles.muted}>{`Figures as of ${formatDate(asOf)}`}</Text>

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
            By team
          </Heading>
          <table role="presentation" cellPadding={0} cellSpacing={0} style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Team</th>
                <th style={{ ...styles.th, ...num }}>Members</th>
                <th style={{ ...styles.th, ...num }}>Completed</th>
                <th style={{ ...styles.th, ...num }}>Valid</th>
                <th style={{ ...styles.th, ...num }}>Expiring</th>
                <th style={{ ...styles.th, ...num }}>Expired</th>
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
            Expiring in the next 60 days
          </Heading>
          <ExpiryTable items={report.upcoming} withMember moreHref={appLink(appUrl, "/records")} />
        </>
      ) : null}
    </EmailLayout>
  );
}
