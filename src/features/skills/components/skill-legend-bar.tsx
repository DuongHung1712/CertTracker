"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, HelpCircle, ShieldAlert } from "lucide-react";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { SkillLevel } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SkillLegendBarProps {
  className?: string;
  defaultExpanded?: boolean;
}

const LEVELS: SkillLevel[] = [0, 1, 2, 3, 4, 5];

export function SkillLegendBar({
  className,
  defaultExpanded = false,
}: SkillLegendBarProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card transition-all",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-3.5 text-primary" />
          <span className="font-mono text-label uppercase font-semibold text-foreground">
            Official Competency Scale Legend (0–5)
          </span>
          <span className="hidden sm:inline text-[11px] text-muted-foreground">
            · Real-world capability &amp; knowledge depth matrix
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-7 px-2 text-caption font-medium text-muted-foreground hover:text-foreground"
        >
          <span>{expanded ? "Hide Legend" : "Show Scale Reference"}</span>
          {expanded ? (
            <ChevronUp className="size-3.5 ml-1" />
          ) : (
            <ChevronDown className="size-3.5 ml-1" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border/70 p-3 pt-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {LEVELS.map((lvl) => {
              const item = LEVEL_SCALE_GUIDE[lvl];
              const isMaster = lvl === 5;
              const isExpert = lvl === 4;

              return (
                <div
                  key={lvl}
                  className={cn(
                    "flex flex-col gap-1 rounded-md border p-2 text-left transition-colors",
                    isMaster
                      ? "border-primary/40 bg-primary/5"
                      : isExpert
                        ? "border-primary/20 bg-primary/5"
                        : "border-border/70 bg-muted/20",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 font-mono text-[10px] font-bold uppercase",
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
                    {isMaster && (
                      <span title="DC Manager review required">
                        <ShieldAlert className="size-3 text-primary" />
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-semibold text-foreground truncate">
                    {item.title}
                  </span>

                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                    {item.officialLegend}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
