"use client";

import * as React from "react";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { SkillLevel } from "../types";
import { SkillLegendPopover } from "./skill-legend-popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SkillQuickRateProps {
  skillId: string;
  skillName: string;
  currentLevel: SkillLevel;
  targetLevel?: SkillLevel;
  onRate: (level: SkillLevel) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  showLabels?: boolean;
  showLegendTrigger?: boolean;
}

const LEVELS: SkillLevel[] = [0, 1, 2, 3, 4, 5];

/**
 * 1-Click Inline Quick-Rate Component
 * Segmented 0–5 pill bar allowing users to change competency level instantly in 1 click.
 * Includes official 0–5 legend descriptions in tooltips, role target markers, and keyboard navigation.
 */
export function SkillQuickRate({
  skillName,
  currentLevel,
  targetLevel,
  onRate,
  size = "md",
  disabled = false,
  className,
  showLabels = false,
  showLegendTrigger = false,
}: SkillQuickRateProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Keyboard navigation across segmented pills
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;

    // Number keys 0-5 directly set level
    if (["0", "1", "2", "3", "4", "5"].includes(e.key)) {
      e.preventDefault();
      const num = parseInt(e.key, 10) as SkillLevel;
      onRate(num);
      focusPill(num);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(5, currentLevel + 1) as SkillLevel;
      onRate(next);
      focusPill(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(0, currentLevel - 1) as SkillLevel;
      onRate(prev);
      focusPill(prev);
    } else if (e.key === "Home") {
      e.preventDefault();
      onRate(0);
      focusPill(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onRate(5);
      focusPill(5);
    }
  }

  function focusPill(level: SkillLevel) {
    const button = containerRef.current?.querySelector<HTMLButtonElement>(
      `button[data-level="${level}"]`,
    );
    button?.focus();
  }

  return (
    <TooltipProvider delay={100}>
      <div
        ref={containerRef}
        role="radiogroup"
        tabIndex={0}
        aria-label={`Rate proficiency for ${skillName}, currently level ${currentLevel}`}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex items-center gap-1 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs",
          className,
        )}
      >
        {LEVELS.map((level) => {
          const info = LEVEL_SCALE_GUIDE[level];
          const isSelected = currentLevel === level;
          const isTarget = targetLevel === level;
          const isMaster = level === 5;
          const isExpert = level === 4;

          const buttonClass = cn(
            "relative inline-flex items-center justify-center font-mono font-semibold transition-all duration-150 rounded-xs cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-90 active:brightness-95",
            size === "sm"
              ? "h-6 min-w-[24px] px-1 text-[11px]"
              : "h-7 min-w-[28px] px-1.5 text-caption",
            // Unselected state
            !isSelected &&
              "bg-muted/40 text-muted-foreground border border-border/60 hover:bg-muted hover:text-foreground hover:border-foreground/40",
            // Selected states
            isSelected &&
              level === 0 &&
              "bg-muted-foreground/20 text-foreground border border-muted-foreground/40 font-bold shadow-2xs",
            isSelected &&
              level >= 1 &&
              level <= 3 &&
              "bg-foreground text-background border border-foreground font-bold shadow-2xs",
            isSelected &&
              isExpert &&
              "bg-primary text-primary-foreground border border-primary font-bold shadow-2xs",
            isSelected &&
              isMaster &&
              "bg-primary text-primary-foreground border border-primary font-bold shadow-2xs ring-1 ring-primary/40",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          );

          return (
            <Tooltip key={level}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    role="radio"
                    data-level={level}
                    aria-checked={isSelected}
                    aria-label={`Level ${level} (${info.percentageRange}) - ${info.title}: ${info.officialLegend}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => {
                      if (!disabled) {
                        onRate(level);
                      }
                    }}
                    className={buttonClass}
                  />
                }
              >
                <span>{level}</span>
                {isTarget && (
                  <span
                    className={cn(
                      "absolute -top-1 right-0 size-1 rounded-full",
                      isSelected ? (level === 0 ? "bg-primary" : "bg-background") : "bg-primary",
                    )}
                    aria-hidden="true"
                    title={`Target: Level ${level}`}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="flex flex-col gap-0.5 max-w-xs p-2 text-left bg-popover text-popover-foreground border border-border shadow-md"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
                  <span className="font-mono font-bold text-caption text-foreground">
                    Level {level} · {info.percentageRange}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase px-1 py-0.2 rounded-xs",
                      isMaster || isExpert ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {info.title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-0.5 leading-snug">
                  {info.officialLegend}
                </p>
                {isTarget && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary">
                    <span>★ Target role standard</span>
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {showLabels && (
          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
            L{currentLevel} · {LEVEL_SCALE_GUIDE[currentLevel].percentageRange}
          </span>
        )}

        {showLegendTrigger && (
          <SkillLegendPopover align="start" side="top" className="ml-0.5" />
        )}
      </div>
    </TooltipProvider>
  );
}
