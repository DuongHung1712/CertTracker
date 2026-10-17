import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { capItems, MAX_LINES, type ExpiryBucket, type ExpiryItem } from "@/features/notifications/expiry-plan";
import { formatDate } from "@/lib/format";
import { EMAIL_THEME as c } from "@/lib/email/theme";

const FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Inline style objects: mail clients ignore CSS variables and most stylesheets. Colours come from EMAIL_THEME only. */
export const styles = {
  body: { margin: 0, padding: "24px 12px", backgroundColor: c.background, fontFamily: FONT, color: c.foreground },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: c.card,
    border: `1px solid ${c.border}`,
    borderRadius: "8px",
    padding: "24px",
  },
  brand: { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: c.primary },
  h2: { margin: "24px 0 8px", fontSize: "16px", fontWeight: 700, color: c.foreground },
  text: { margin: "0 0 12px", fontSize: "14px", lineHeight: "20px", color: c.foreground },
  muted: { margin: "0 0 12px", fontSize: "13px", lineHeight: "18px", color: c.mutedForeground },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: {
    padding: "6px 8px",
    textAlign: "left",
    color: c.mutedForeground,
    fontWeight: 600,
    borderBottom: `1px solid ${c.border}`,
  },
  td: { padding: "8px", verticalAlign: "top", color: c.foreground, borderBottom: `1px solid ${c.border}` },
  link: { color: c.primary, textDecoration: "underline" },
  footer: { margin: "0 0 4px", fontSize: "12px", lineHeight: "18px", color: c.mutedForeground },
} satisfies Record<string, CSSProperties>;

const cleanBase = (appUrl: string) => appUrl.replace(/\/+$/, "");
export const appLink = (appUrl: string | null, path: string): string | null => (appUrl ? `${cleanBase(appUrl)}${path}` : null);

export function EmailLayout({ preview, children, appUrl }: { preview: string; children: ReactNode; appUrl: string | null }) {
  return (
    <Html lang="vi">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading as="h1" style={styles.brand}>
            CertTracker
          </Heading>
          {children}
          <Hr style={{ borderColor: c.border, margin: "24px 0 12px" }} />
          <Section>
            <Text style={styles.footer}>Email tự động từ CertTracker — vui lòng không trả lời.</Text>
            {appUrl ? (
              <Text style={styles.footer}>
                <Link href={appUrl} style={styles.link}>
                  Mở CertTracker
                </Link>
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const BUCKET_STYLE: Record<ExpiryBucket, CSSProperties> = {
  expired: { backgroundColor: c.expiredBg, color: c.expiredFg },
  soon: { backgroundColor: c.expiringSoonBg, color: c.expiringSoonFg },
  in60: { backgroundColor: c.expiring60Bg, color: c.expiring60Fg },
};

export function bucketText(item: Pick<ExpiryItem, "bucket" | "daysToExpiry">): string {
  return item.bucket === "expired" ? `Đã hết hạn ${-item.daysToExpiry} ngày` : `Còn ${item.daysToExpiry} ngày`;
}

/** Items are capped at MAX_LINES; the rest collapse into "và N chứng chỉ khác" (+ a link when the app URL is known). */
export function ExpiryTable({
  items,
  withMember,
  moreHref,
}: {
  items: ExpiryItem[];
  withMember: boolean;
  moreHref: string | null;
}) {
  const { shown, hidden } = capItems(items, MAX_LINES);
  const columns = withMember ? 4 : 3;
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={styles.table}>
      <thead>
        <tr>
          {withMember ? <th style={styles.th}>Thành viên</th> : null}
          <th style={styles.th}>Chứng chỉ</th>
          <th style={styles.th}>Hạn</th>
          <th style={styles.th}>Còn lại</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((item) => (
          <tr key={item.recordId}>
            {withMember ? <td style={styles.td}>{`${item.memberName} (${item.memberCode})`}</td> : null}
            <td style={styles.td}>{item.courseName}</td>
            <td style={styles.td}>{formatDate(item.expiryDate)}</td>
            <td style={styles.td}>
              <span
                style={{ ...BUCKET_STYLE[item.bucket], display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontWeight: 600 }}
              >
                {bucketText(item)}
              </span>
            </td>
          </tr>
        ))}
        {hidden > 0 ? (
          <tr>
            <td colSpan={columns} style={{ ...styles.td, color: c.mutedForeground }}>
              {`và ${hidden} chứng chỉ khác`}
              {moreHref ? (
                <>
                  {" — "}
                  <Link href={moreHref} style={styles.link}>
                    Xem đầy đủ
                  </Link>
                </>
              ) : null}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
