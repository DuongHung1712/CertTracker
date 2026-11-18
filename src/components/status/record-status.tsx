import { CircleCheck, CircleDashed, Hourglass, LoaderCircle, Undo2, type LucideIcon } from "lucide-react";
import { RECORD_STATUS_LABEL, type RecordStatus } from "@/components/status/labels";
import { Badge } from "@/components/ui/badge";
import type { ApprovalState } from "@/features/records/kind";

const ICON: Record<RecordStatus, LucideIcon> = {
  done: CircleCheck,
  in_progress: LoaderCircle,
  not_started: CircleDashed,
};

export function RecordStatusLabel({ status }: { status: RecordStatus }) {
  const Icon = ICON[status];
  return (
    // data-stamp: the Credential Vault style draws every status as one kind of stamp (globals.css).
    <span data-stamp={status} className="inline-flex items-center gap-1.5 text-table text-foreground">
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      {RECORD_STATUS_LABEL[status]}
    </span>
  );
}

const APPROVAL_BADGE = {
  waiting: { icon: Hourglass, label: "Waiting for approval", variant: "secondary" },
  returned: { icon: Undo2, label: "Returned", variant: "destructive" },
} as const;

/** Next to Completed: nothing for Approved, text plus icon (not colour alone) for the other two. */
export function ApprovalBadge({ approval }: { approval: ApprovalState | null }) {
  if (approval !== "waiting" && approval !== "returned") return null;
  const { icon: Icon, label, variant } = APPROVAL_BADGE[approval];
  return (
    <Badge data-stamp={approval} variant={variant} className="rounded-sm whitespace-nowrap">
      <Icon aria-hidden className="size-4" />
      {label}
    </Badge>
  );
}

/** Shown on learning items whose certificate was proposed by a member and is waiting for catalogue approval. */
export function CatalogueStatusBadge({ status }: { status?: "approved" | "pending" | "rejected" | null }) {
  if (status !== "pending" && status !== "rejected") return null;
  if (status === "pending") {
    return (
      <Badge
        data-stamp="catalogue-pending"
        variant="outline"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border-status-expiring-soon-border bg-status-expiring-soon-bg text-caption text-status-expiring-soon-fg"
      >
        <Hourglass aria-hidden className="size-3" />
        Pending Approval
      </Badge>
    );
  }
  return (
    <Badge
      data-stamp="catalogue-rejected"
      variant="destructive"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-caption"
    >
      <Undo2 aria-hidden className="size-3" />
      Rejected
    </Badge>
  );
}
