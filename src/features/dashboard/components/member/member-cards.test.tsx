import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditVerificationCard } from "./audit-verification-card";
import { ComplianceCopilotCard } from "./compliance-copilot-card";
import { QuarterlyTargetCard } from "./quarterly-target-card";
import { SkillsMatrixCard } from "./skills-matrix-card";
import { TargetRoleCard } from "./target-role-card";

describe("Member Dashboard Modular Cards", () => {
  it("renders AuditVerificationCard with accessible region", () => {
    const html = renderToStaticMarkup(<AuditVerificationCard />);
    expect(html).toContain('aria-label="Audit verification (Coming soon)"');
    expect(html).toContain("Audit verification");
    expect(html).toContain("0 Pending");
    expect(html).toContain("All clear!");
  });

  it("renders ComplianceCopilotCard with disabled controls", () => {
    const html = renderToStaticMarkup(<ComplianceCopilotCard />);
    expect(html).toContain('aria-label="Compliance copilot (Coming soon)"');
    expect(html).toContain("Compliance copilot");
    expect(html).toContain("Ask about certification policy or exam budget…");
    expect(html).toContain("What is needed for AWS renewal?");
    expect(html).toContain('disabled=""');
  });

  it("renders QuarterlyTargetCard with objective and progress", () => {
    const html = renderToStaticMarkup(<QuarterlyTargetCard />);
    expect(html).toContain('aria-label="Quarterly objective (Coming soon)"');
    expect(html).toContain("Q1 compliance objective");
    expect(html).toContain("Get 2 certificates in Cloud by Q1");
    expect(html).toContain("1 of 2 completed (50%)");
    expect(html).toContain("Join a team goal");
  });

  it("renders SkillsMatrixCard with skills", () => {
    const html = renderToStaticMarkup(<SkillsMatrixCard />);
    expect(html).toContain('aria-label="My skills matrix (Coming soon)"');
    expect(html).toContain("My skills matrix");
    expect(html).toContain("Cloud Architecture");
    expect(html).toContain("Kubernetes");
  });

  it("renders TargetRoleCard with criteria", () => {
    const html = renderToStaticMarkup(<TargetRoleCard />);
    expect(html).toContain('aria-label="Target role (Coming soon)"');
    expect(html).toContain("Target: Staff engineer");
    expect(html).toContain("Lead cloud migration project");
  });
});
