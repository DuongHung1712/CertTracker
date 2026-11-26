import { Clock, ShieldCheck, Undo2, UserCheck } from "lucide-react";
import type { VerificationStatus } from "../types";
import { cn } from "@/lib/utils";

export const SKILL_STATUS_LABEL: Record<VerificationStatus, string> = {
  certified: "Certified",
  pending_review: "Waiting for review",
  self_assessed: "Self-rated",
  returned: "Returned",
};

// Reuses the ExpiryBadge tones so the Vault style colours the live dot.
const STATUS_STYLE = {
  certified: { icon: ShieldCheck, tone: "active", text: "text-primary", stamp: undefined },
  pending_review: { icon: Clock, tone: "expiring-soon", text: "text-foreground", stamp: undefined },
  self_assessed: { icon: UserCheck, tone: "na", text: "text-muted-foreground", stamp: undefined },
  returned: { icon: Undo2, tone: "expired", text: "text-destructive", stamp: "returned" },
} as const;

/** How a skill's level is backed: a certificate, a pending manager review, a return note, or the member's own rating. */
export function SkillStatus({ status, className }: { status: VerificationStatus; className?: string }) {
  const { icon: Icon, tone, text, stamp } = STATUS_STYLE[status];
  return (
    <span
      data-status-tone={tone}
      data-stamp={stamp}
      className={cn("inline-flex items-center gap-1 text-caption font-medium whitespace-nowrap", text, className)}
    >
      <span className="vault-live-dot" aria-hidden />
      <Icon className="size-3.5" aria-hidden />
      {SKILL_STATUS_LABEL[status]}
    </span>
  );
}
