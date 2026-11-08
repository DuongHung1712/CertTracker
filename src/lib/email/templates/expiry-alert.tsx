import { Heading, Text } from "@react-email/components";
import type { ExpiryAlert } from "@/features/notifications/expiry-plan";
import { weekLabel } from "@/features/notifications/period";
import { appLink, EmailLayout, ExpiryTable, styles } from "@/lib/email/templates/layout";
import { pluralize } from "@/lib/plural";

/** Subject and preview line: counts and the period label only, never a name. */
export function expiryHeadline(total: number, period: string): string {
  const verb = total === 1 ? "expires soon or has expired" : "expire soon or have expired";
  return `${pluralize(total, "certificate")} ${verb} (${weekLabel(period)})`;
}

/** Every user-controlled string below goes through JSX text, so React escapes it. */
export function ExpiryAlertEmail({ alert, period, appUrl }: { alert: ExpiryAlert; period: string; appUrl: string | null }) {
  const total = alert.own.length + alert.teams.reduce((n, t) => n + t.items.length, 0);
  return (
    <EmailLayout preview={expiryHeadline(total, period)} appUrl={appUrl}>
      <Text style={styles.text}>{alert.name ? `Hello ${alert.name},` : "Hello,"}</Text>
      <Text style={styles.text}>
        {`These certificates expire within the next 60 days or expired within the last 30 days (${weekLabel(period)}).`}
      </Text>

      {alert.own.length > 0 ? (
        <>
          <Heading as="h2" style={styles.h2}>
            Your certificates
          </Heading>
          <ExpiryTable items={alert.own} withMember={false} moreHref={appLink(appUrl, "/me")} />
        </>
      ) : null}

      {alert.teams.map((team) => (
        <div key={team.teamId}>
          <Heading as="h2" style={styles.h2}>
            {`Team ${team.teamName}`}
          </Heading>
          <ExpiryTable items={team.items} withMember moreHref={appLink(appUrl, "/records")} />
        </div>
      ))}
    </EmailLayout>
  );
}
