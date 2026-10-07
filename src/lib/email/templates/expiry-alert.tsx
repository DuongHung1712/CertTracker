import { Heading, Text } from "@react-email/components";
import type { ExpiryAlert } from "@/features/notifications/expiry-plan";
import { weekLabel } from "@/features/notifications/period";
import { appLink, EmailLayout, ExpiryTable, styles } from "@/lib/email/templates/layout";

/** Every user-controlled string below goes through JSX text, so React escapes it. */
export function ExpiryAlertEmail({ alert, period, appUrl }: { alert: ExpiryAlert; period: string; appUrl: string | null }) {
  const total = alert.own.length + alert.teams.reduce((n, t) => n + t.items.length, 0);
  return (
    <EmailLayout preview={`${total} chứng chỉ cần chú ý (${weekLabel(period)})`} appUrl={appUrl}>
      <Text style={styles.text}>{alert.name ? `Xin chào ${alert.name}` : "Xin chào"}</Text>
      <Text style={styles.text}>
        {`Đây là các chứng chỉ sắp hết hạn trong 60 ngày tới và vừa hết hạn trong 30 ngày qua (${weekLabel(period)}).`}
      </Text>

      {alert.own.length > 0 ? (
        <>
          <Heading as="h2" style={styles.h2}>
            Của bạn
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
