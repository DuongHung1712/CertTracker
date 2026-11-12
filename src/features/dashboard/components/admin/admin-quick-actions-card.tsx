import Link from "next/link";
import { FileSpreadsheet, PlusCircle, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/records", label: "Add learning", icon: PlusCircle },
  { href: "/members", label: "Add member", icon: UserPlus },
  { href: "/import", label: "Import from Excel", icon: FileSpreadsheet },
];

export function AdminQuickActionsCard() {
  return (
    <section aria-label="Quick actions" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <span className="font-mono text-label tracking-wider text-muted-foreground">Quick actions</span>
      <div className="flex flex-col gap-2">
        {ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(buttonVariants({ variant: "outline" }), "justify-start gap-2 text-caption font-medium")}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
