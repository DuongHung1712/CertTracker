import { Award } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";

export function TargetRoleCard() {
  return (
    <ComingSoonCard
      title="Next career role"
      description="See what your next role needs: certificates, experience and skills. Not available yet."
      icon={<Award className="size-3.5" />}
    />
  );
}
