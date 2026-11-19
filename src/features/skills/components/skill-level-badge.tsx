import * as React from "react";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { SkillLevel } from "../types";
import { cn } from "@/lib/utils";

interface SkillLevelBadgeProps {
  currentLevel: SkillLevel;
  targetLevel?: SkillLevel;
  showSegments?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Renders a segmented rating bar and badge for skill levels 0 to 5.
 * Adapts to Classic Swiss (clean flat tokens) and Credential Vault (precision borders, live status cue).
 */
export function SkillLevelBadge({
  currentLevel,
  targetLevel,
  showSegments = true,
  size = "md",
  className,
}: SkillLevelBadgeProps) {
  const levelInfo = LEVEL_SCALE_GUIDE[currentLevel];
  const meetsTarget = targetLevel !== undefined ? currentLevel >= targetLevel : true;

  return (
    <div
      className={cn("inline-flex flex-col gap-1.5", className)}
      role="group"
      aria-label={`Skill level ${currentLevel} of 5 (${levelInfo.title})${
        targetLevel !== undefined ? `, target level ${targetLevel}` : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-caption font-semibold tracking-wide uppercase transition-colors",
            "vault-mono-tag",
            currentLevel >= 4
              ? "bg-primary/10 text-primary border border-primary/20"
              : currentLevel >= 2
                ? "bg-muted text-foreground border border-border"
                : "bg-muted/60 text-muted-foreground border border-border/50",
            size === "sm" && "text-[11px] px-1.5 py-0",
          )}
        >
          {levelInfo.badgeLabel}
        </span>

        {targetLevel !== undefined && (
          <span
            className={cn(
              "text-[11px] tabular-nums font-medium",
              meetsTarget ? "text-primary" : "text-muted-foreground",
            )}
          >
            {meetsTarget
              ? currentLevel > targetLevel
                ? `+${currentLevel - targetLevel} above standard`
                : "Meets standard"
              : `-${targetLevel - currentLevel} below target`}
          </span>
        )}
      </div>

      {showSegments && (
        <div
          className={cn("flex items-center gap-1", targetLevel !== undefined && "pb-2")}
          aria-hidden="true"
        >
          {([1, 2, 3, 4, 5] as const).map((step) => {
            const isFilled = currentLevel >= step;
            const isTargetMarker = targetLevel === step;

            return (
              <div
                key={step}
                className="relative flex flex-col items-center"
                title={`Level ${step}`}
              >
                <div
                  className={cn(
                    "h-1.5 w-5 rounded-xs transition-colors",
                    isFilled
                      ? currentLevel >= 4
                        ? "bg-primary"
                        : "bg-foreground/75"
                      : "bg-muted border border-border/60",
                    size === "sm" && "w-3.5 h-1",
                  )}
                />
                {isTargetMarker && (
                  <span
                    className="absolute -bottom-2 text-[9px] leading-none font-bold text-muted-foreground"
                    title={`Role Target: L${step}`}
                  >
                    ▲
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
