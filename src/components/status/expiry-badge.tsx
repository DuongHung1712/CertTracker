import {
  CircleCheck,
  CircleX,
  Clock,
  Infinity as InfinityIcon,
  Minus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { expiryDetail, expiryMeta, toExpiryStatus, type ExpiryTone } from "@/components/status/expiry";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<ExpiryTone, string> = {
  active: "border-status-active-border bg-status-active-bg text-status-active-fg",
  "expiring-60": "border-status-expiring-60-border bg-status-expiring-60-bg text-status-expiring-60-fg",
  "expiring-soon": "border-status-expiring-soon-border bg-status-expiring-soon-bg text-status-expiring-soon-fg",
  expired: "border-status-expired-border bg-status-expired-bg text-status-expired-fg",
  "no-expiry": "border-status-no-expiry-border bg-status-no-expiry-bg text-status-no-expiry-fg",
  na: "border-status-na-border bg-status-na-bg text-status-na-fg",
};

const TONE_ICON: Record<ExpiryTone, LucideIcon> = {
  active: CircleCheck,
  "expiring-60": Clock,
  "expiring-soon": TriangleAlert,
  expired: CircleX,
  "no-expiry": InfinityIcon,
  na: Minus,
};

export function ExpiryBadge({
  status,
  daysToExpiry,
  expiryDate,
  className,
}: {
  status: string | null;
  daysToExpiry: number | null;
  expiryDate: string | null;
  className?: string;
}) {
  const expiryStatus = toExpiryStatus(status);
  const { tone, label } = expiryMeta(expiryStatus);
  const Icon = TONE_ICON[tone];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-caption font-medium whitespace-nowrap",
              TONE_CLASS[tone],
              className,
            )}
          />
        }
      >
        <Icon aria-hidden className="size-3.5" />
        {label}
      </TooltipTrigger>
      <TooltipContent>{expiryDetail({ status: expiryStatus, daysToExpiry, expiryDate })}</TooltipContent>
    </Tooltip>
  );
}
