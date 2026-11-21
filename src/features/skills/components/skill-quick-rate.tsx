"use client";

import * as React from "react";
import { LEVEL_SCALE_GUIDE, SKILL_LEVELS } from "../schema";
import type { SkillLevel } from "../types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SkillQuickRateProps {
  skillName: string;
  currentLevel: SkillLevel;
  onRate: (level: SkillLevel) => void;
  className?: string;
}

const KEY_TO_LEVEL: Record<string, (current: SkillLevel) => SkillLevel> = {
  ArrowRight: (c) => Math.min(5, c + 1) as SkillLevel,
  ArrowDown: (c) => Math.min(5, c + 1) as SkillLevel,
  ArrowLeft: (c) => Math.max(0, c - 1) as SkillLevel,
  ArrowUp: (c) => Math.max(0, c - 1) as SkillLevel,
  Home: () => 0,
  End: () => 5,
};

/**
 * One-click 0–5 rating. A radio group with roving focus: arrows, Home/End and
 * digit keys change the level.
 */
export function SkillQuickRate({ skillName, currentLevel, onRate, className }: SkillQuickRateProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const next = /^[0-5]$/.test(e.key) ? (Number(e.key) as SkillLevel) : KEY_TO_LEVEL[e.key]?.(currentLevel);
    if (next === undefined) return;
    e.preventDefault();
    onRate(next);
    containerRef.current?.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)?.focus();
  }

  return (
    <TooltipProvider delay={300}>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label={`Your level for ${skillName}`}
        onKeyDown={handleKeyDown}
        className={cn("inline-flex items-center gap-1", className)}
      >
        {SKILL_LEVELS.map((level) => {
          const info = LEVEL_SCALE_GUIDE[level];
          const isSelected = currentLevel === level;
          return (
            <Tooltip key={level}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    role="radio"
                    data-level={level}
                    aria-checked={isSelected}
                    aria-label={`Level ${level}, ${info.title}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onRate(level)}
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-md border font-mono text-caption tabular-nums transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary font-semibold text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  />
                }
              >
                {level}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64 text-left">
                <span className="font-semibold">
                  Level {level} · {info.title}
                </span>
                <span className="block">{info.officialLegend}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
