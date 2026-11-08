import Link from "next/link";
import { CheckCircle2, PlusCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuickActionsCard() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Quick actions
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href="/records"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "justify-start gap-2 text-caption font-medium",
          )}
        >
          <PlusCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Add certificate</span>
        </Link>

        <Link
          href="/data-quality"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "justify-start gap-2 text-caption font-medium",
          )}
        >
          <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>View team data quality</span>
        </Link>
      </div>
    </div>
  );
}
