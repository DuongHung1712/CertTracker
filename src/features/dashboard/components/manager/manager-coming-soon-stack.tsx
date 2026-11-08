import { HelpCircle } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";
import { DashboardTabStrip } from "@/features/dashboard/components/dashboard-tab-strip";

export function ManagerTabStrip() {
  return <DashboardTabStrip label="Manager dashboard views" soon={["Approvals", "Skills", "Goals"]} />;
}

export function AskAboutMyTeamComingSoon() {
  return (
    <ComingSoonCard
      title="Ask about my team"
      description="Ask questions about your team's certificates and get alerts about certificate risks. Not available yet."
      icon={<HelpCircle className="size-4" />}
    />
  );
}
