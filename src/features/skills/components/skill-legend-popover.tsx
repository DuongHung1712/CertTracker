"use client";

import * as React from "react";
import { ExternalLink, HelpCircle, ShieldAlert } from "lucide-react";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { SkillLevel } from "../types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SkillLegendPopoverProps {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  triggerClassName?: string;
  onOpenFullGuide?: () => void;
  triggerLabel?: string;
}

const LEVELS: SkillLevel[] = [0, 1, 2, 3, 4, 5];

/**
 * Embeddable Official Scale Reference Popover
 * Directly accessible via click/hover next to rating controls so engineers
 * always know what numbers 0–5 mean without modal friction or context loss.
 */
export function SkillLegendPopover({
  align = "end",
  side = "bottom",
  className,
  triggerClassName,
  onOpenFullGuide,
  triggerLabel,
}: SkillLegendPopoverProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="View official competency scale reference (0–5)"
            title="View 0–5 scale definitions"
            className={cn(
              "inline-flex items-center gap-1 rounded-xs p-1 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              triggerClassName,
            )}
          >
            <HelpCircle className="size-3.5 text-primary" />
            {triggerLabel && (
              <span className="text-[11px] font-medium">{triggerLabel}</span>
            )}
          </button>
        }
      />
      <PopoverContent
        align={align}
        side={side}
        className={cn(
          "w-88 p-3 text-left bg-popover text-popover-foreground border border-border shadow-lg",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-label uppercase font-bold text-foreground">
              Competency Scale Legend
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">0 – 5 Matrix</span>
        </div>

        {/* 6 Scale Definitions */}
        <div className="flex flex-col gap-1.5">
          {LEVELS.map((lvl) => {
            const item = LEVEL_SCALE_GUIDE[lvl];
            const isMaster = lvl === 5;
            const isExpert = lvl === 4;

            return (
              <div
                key={lvl}
                className={cn(
                  "flex items-start gap-2 rounded-xs p-1.5 transition-colors border",
                  isMaster
                    ? "border-primary/30 bg-primary/5"
                    : isExpert
                      ? "border-primary/20 bg-primary/5"
                      : "border-border/50 bg-muted/20",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.2 font-mono text-[10px] font-bold uppercase",
                    "vault-mono-tag",
                    isMaster
                      ? "bg-primary text-primary-foreground"
                      : isExpert
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : lvl >= 2
                          ? "bg-muted text-foreground border border-border"
                          : "bg-muted/80 text-muted-foreground",
                  )}
                >
                  L{lvl} · {item.percentageRange}
                </span>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground">
                      {item.title}
                    </span>
                    {isMaster && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary">
                        <ShieldAlert className="size-2.5" />
                        Manager Req.
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {item.officialLegend}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Link to Full Guide */}
        {onOpenFullGuide && (
          <div className="mt-2.5 pt-2 border-t border-border/70 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Official DC34 standard
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                onOpenFullGuide();
              }}
              className="h-6 px-1.5 text-[11px] text-primary hover:text-primary hover:bg-primary/10 font-medium flex items-center gap-1"
            >
              <span>Full Details</span>
              <ExternalLink className="size-3" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
