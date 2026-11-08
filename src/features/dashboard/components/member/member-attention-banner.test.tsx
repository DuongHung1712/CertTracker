import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberAttentionBanner } from "./member-attention-banner";
import type { RecordRow } from "@/features/records/queries";

function makeRecord(partial: Partial<RecordRow>): RecordRow {
  return {
    id: "r1",
    memberId: "m1",
    memberCode: "M001",
    memberName: "Le Minh Chau",
    memberEmail: "member@certtracker.test",
    teamId: "t1",
    teamName: "Team Cloud",
    courseId: "c1",
    courseName: "AWS Solutions Architect Associate",
    certTypeName: "Cloud",
    providerName: "AWS",
    validityMonths: 36,
    cost: 150,
    costCurrency: "USD",
    estHours: 40,
    status: "done",
    progress: 100,
    plannedExamDate: null,
    issuedDate: "2023-10-01",
    certificateUrl: null,
    hasEvidence: false,
    viaCompany: false,
    refundStatus: "n_a",
    notes: null,
    expiryDate: "2026-11-20",
    daysToExpiry: 12,
    expiryStatus: "expiring-soon",
    ...partial,
  };
}

describe("MemberAttentionBanner", () => {
  it("renders null when attention is null", () => {
    const html = renderToStaticMarkup(
      <MemberAttentionBanner attention={null} onUploadProof={() => {}} />,
    );
    expect(html).toBe("");
  });

  it("renders urgent banner for certificate expiring soon", () => {
    const record = makeRecord({ daysToExpiry: 12, expiryStatus: "expiring-soon" });
    const html = renderToStaticMarkup(
      <MemberAttentionBanner
        attention={{ record, urgency: "urgent" }}
        onUploadProof={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Certificate attention required"');
    expect(html).toContain("Action needed:");
    expect(html).toContain("AWS Solutions Architect Associate");
    expect(html).toContain("12 days left");
    expect(html).toContain("Upload proof");
    expect(html).toContain("var(--status-expiring-soon-bg)");
  });

  it("renders expired banner for expired certificate", () => {
    const record = makeRecord({ daysToExpiry: -5, expiryStatus: "expired", expiryDate: "2026-11-01" });
    const html = renderToStaticMarkup(
      <MemberAttentionBanner
        attention={{ record, urgency: "expired" }}
        onUploadProof={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Certificate attention required"');
    expect(html).toContain("Certificate expired:");
    expect(html).toContain("Expired on 01/11/2026");
    expect(html).toContain("Upload proof");
    expect(html).toContain("var(--status-expired-bg)");
  });
});
