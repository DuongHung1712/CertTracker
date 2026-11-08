import { Compass } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";

export function SkillsMatrixCard() {
  return (
    <ComingSoonCard
      title="My skills"
      description="See your skill levels next to your team's standards. Not available yet."
      icon={<Compass className="size-3.5" />}
    />
  );
}
