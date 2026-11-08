import { AuditVerificationCard } from "./audit-verification-card";
import { ComplianceCopilotCard } from "./compliance-copilot-card";
import { QuarterlyTargetCard } from "./quarterly-target-card";
import { SkillsMatrixCard } from "./skills-matrix-card";
import { TargetRoleCard } from "./target-role-card";

export function MemberComingSoonStack() {
  return (
    <div className="flex flex-col gap-3.5">
      <ComplianceCopilotCard />
      <SkillsMatrixCard />
      <QuarterlyTargetCard />
      <TargetRoleCard />
      <AuditVerificationCard />
    </div>
  );
}
