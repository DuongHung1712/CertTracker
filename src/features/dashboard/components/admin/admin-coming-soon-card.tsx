import { AlertTriangle, Bot, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AdminComingSoonCard() {
  return (
    <section
      aria-label="Compliance assistant and insights (Coming soon)"
      className="flex flex-col gap-4 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Coming soon
        </span>
        <Badge variant="outline" className="border-dashed font-mono text-caption text-muted-foreground">
          Soon
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        {/* Module 1: Compliance assistant */}
        <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-card/60 p-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-foreground">Compliance assistant</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Ask questions about certificate status, expiring credentials, and audit readiness in natural language. Not available yet.
          </p>
        </div>

        {/* Module 2: Monthly summary */}
        <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-card/60 p-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-foreground">Monthly summary</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Automated monthly digest of certifications, team milestones, and renewal progress across all departments. Not available yet.
          </p>
        </div>

        {/* Module 3: Risk alerts */}
        <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-card/60 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-foreground">Risk alerts</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Proactive alerts for key-person risk, critical certificate expiry, and single-point-of-failure coverage. Not available yet.
          </p>
        </div>
      </div>
    </section>
  );
}
