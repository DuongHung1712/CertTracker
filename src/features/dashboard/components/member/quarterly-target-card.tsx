import { Target } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";

export function QuarterlyTargetCard() {
  return (
    <ComingSoonCard
      title="Quarterly goals"
      description="Set a certificate goal for each quarter and follow it with your team. Not available yet."
      icon={<Target className="size-3.5" />}
    />
  );
}
