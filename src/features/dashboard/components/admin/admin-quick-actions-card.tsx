import Link from "next/link";
import { Download, FileSpreadsheet, PlusCircle, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminQuickActionsCard() {
  return (
    <section
      aria-label="Quick actions"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
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
          href="/members"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "justify-start gap-2 text-caption font-medium",
          )}
        >
          <UserPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Invite member</span>
        </Link>

        <Link
          href="/import"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "justify-start gap-2 text-caption font-medium",
          )}
        >
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Import Excel</span>
        </Link>

        <a
          href="/api/export/records?format=csv"
          download
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "justify-start gap-2 text-caption font-medium",
          )}
        >
          <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Export CSV</span>
        </a>
      </div>
    </section>
  );
}
