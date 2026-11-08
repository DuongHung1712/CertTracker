import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuarterlyTargetCard() {
  return (
    <section
      aria-label="Quarterly objective (Coming soon)"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-label uppercase tracking-wider font-semibold text-muted-foreground">
          Q1 compliance objective
        </h3>
        <span className="font-mono text-xs font-medium text-primary">Q1 2027</span>
      </div>

      <p className="text-xs font-medium text-foreground">
        Get 2 certificates in Cloud by Q1
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress meter</span>
          <span className="font-medium text-foreground">1 of 2 completed (50%)</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: "50%" }} />
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          disabled
          aria-disabled="true"
          className="w-full justify-center gap-1.5 text-xs cursor-not-allowed"
        >
          <Users className="size-3.5" aria-hidden="true" />
          <span>Join a team goal</span>
        </Button>
      </div>
    </section>
  );
}
