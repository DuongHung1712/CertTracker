import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberAttentionBanner } from "./member-attention-banner";
import { doneRecord } from "@/features/records/__fixtures__/record-row";

// Production hook (I3): the `<aside>` carries `data-tone`, an `ExpiryTone` from `expiryMeta`:
// "expired" for an expired certificate, "expiring-soon" for one that expires within 60 days.
const tone = (html: string) => /<aside[^>]*data-tone="([^"]+)"/.exec(html)?.[1];

describe("MemberAttentionBanner", () => {
  it("renders null when attention is null", () => {
    const html = renderToStaticMarkup(
      <MemberAttentionBanner attention={null} onUploadProof={() => {}} />,
    );
    expect(html).toBe("");
  });

  it("renders urgent banner for certificate expiring soon", () => {
    const record = doneRecord(12, { expiryDate: "2026-11-20" });
    const html = renderToStaticMarkup(
      <MemberAttentionBanner
        attention={{ record, urgency: "urgent" }}
        onUploadProof={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Certificate attention required"');
    expect(html).toContain("Expires soon:");
    expect(html).toContain("AWS Solutions Architect Associate");
    expect(html).toContain("12 days left");
    expect(html).toContain("Upload evidence");
    expect(html).not.toContain("Certificate expired:");
    expect(tone(html)).toBe("expiring-soon");
  });

  it("uses the expiring tone for a certificate 31 to 60 days from expiry", () => {
    const record = doneRecord(45, { expiryDate: "2026-12-23" });
    const html = renderToStaticMarkup(
      <MemberAttentionBanner attention={{ record, urgency: "expiring" }} onUploadProof={() => {}} />,
    );
    expect(tone(html)).toBe("expiring-soon");
  });

  it("renders expired banner for expired certificate", () => {
    const record = doneRecord(-5, { expiryDate: "2026-11-01" });
    const html = renderToStaticMarkup(
      <MemberAttentionBanner
        attention={{ record, urgency: "expired" }}
        onUploadProof={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Certificate attention required"');
    expect(html).toContain("Certificate expired:");
    expect(html).toContain("Expired on 01/11/2026");
    expect(html).toContain("Upload evidence");
    expect(html).not.toContain("Expires soon:");
    expect(tone(html)).toBe("expired");
  });
});
