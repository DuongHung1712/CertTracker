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
  // font-semibold (the other tones stay font-medium): the 6 status colours
  // have close lightness values, so Expired gets extra visual weight to
  // scan faster in a dense table and to stay distinguishable for a
  // colour-blind reader who can't rely on hue alone.
  expired: "border-status-expired-border bg-status-expired-bg text-status-expired-fg font-semibold",
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
  const detail = expiryDetail({ status: expiryStatus, daysToExpiry, expiryDate });

  return (
    <Tooltip>
      {/*
       * The detail (`sr-only` span below) is always in the accessible tree,
       * not only on hover/focus: Base UI's tooltip doesn't wire up
       * aria-describedby, and tooltips don't open on touch, so a
       * screen-reader or mobile user would otherwise never get "Còn 23
       * ngày…". No `tabIndex` — the badge no longer depends on being
       * focusable to expose that text; the tooltip stays a mouse-only
       * visual extra.
       */}
      <TooltipTrigger
        render={
          <span
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
        <span className="sr-only">, {detail}</span>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}
