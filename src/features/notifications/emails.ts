import { createElement } from "react";
import type { ExpiryAlert } from "@/features/notifications/expiry-plan";
import type { MonthlyReport } from "@/features/notifications/monthly-plan";
import { monthLabel, weekLabel } from "@/features/notifications/period";
import { renderEmail } from "@/lib/email/render";
import { ExpiryAlertEmail } from "@/lib/email/templates/expiry-alert";
import { MonthlyReportEmail } from "@/lib/email/templates/monthly-report";

export type RenderedEmail = { subject: string; html: string; text: string };

const count = (alert: ExpiryAlert) => alert.own.length + alert.teams.reduce((n, t) => n + t.items.length, 0);

/** The subject carries counts and the period label only — never a name, so no data can reach a header. */
export async function buildExpiryEmail(alert: ExpiryAlert, ctx: { period: string; appUrl: string | null }): Promise<RenderedEmail> {
  const body = await renderEmail(createElement(ExpiryAlertEmail, { alert, period: ctx.period, appUrl: ctx.appUrl }));
  return { subject: `[CertTracker] ${count(alert)} chứng chỉ cần chú ý (${weekLabel(ctx.period)})`, ...body };
}

export async function buildMonthlyEmail(report: MonthlyReport, ctx: { appUrl: string | null; today: string }): Promise<RenderedEmail> {
  const body = await renderEmail(createElement(MonthlyReportEmail, { report, appUrl: ctx.appUrl, asOf: ctx.today }));
  return { subject: `[CertTracker] Báo cáo ${monthLabel(report.month)}`, ...body };
}
