import { ShieldCheck } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";

export function AuditVerificationCard() {
  return (
    <ComingSoonCard
      title="Certificate review"
      description="Your manager will check your evidence and confirm each certificate. Not available yet."
      icon={<ShieldCheck className="size-3.5" />}
    />
  );
}
