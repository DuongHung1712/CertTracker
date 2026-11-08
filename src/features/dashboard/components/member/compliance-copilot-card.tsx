import { MessageSquare } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";
import { Input } from "@/components/ui/input";

export function ComplianceCopilotCard() {
  return (
    <ComingSoonCard
      title="Ask about certificates"
      description="Ask questions about exam refunds, renewals and approved courses. Not available yet."
      icon={<MessageSquare className="size-3.5" />}
    >
      <Input
        disabled
        aria-disabled="true"
        aria-label="Your question"
        placeholder="Type your question"
        className="cursor-not-allowed bg-muted/40 text-caption"
      />
    </ComingSoonCard>
  );
}
