"use client";

import { HelpCircle } from "lucide-react";
import { LEVEL_SCALE_GUIDE, SKILL_LEVELS } from "../schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SkillLegendPopoverProps {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

/** "What do 0–5 mean?" next to any rating control, so nobody has to leave the page to check. */
export function SkillLegendPopover({ align = "end", side = "bottom" }: SkillLegendPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="What the levels 0–5 mean"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HelpCircle className="size-3.5" aria-hidden />
          </button>
        }
      />
      <PopoverContent align={align} side={side} className="w-80 p-3">
        <p className="mb-2 text-label uppercase text-muted-foreground">Skill levels</p>
        <dl className="flex flex-col gap-2">
          {SKILL_LEVELS.map((lvl) => {
            const item = LEVEL_SCALE_GUIDE[lvl];
            return (
              <div key={lvl} className="grid grid-cols-[1.25rem_1fr] gap-x-2">
                <dt className="font-mono text-caption font-semibold tabular-nums text-foreground">{lvl}</dt>
                <dd className="text-caption text-muted-foreground">
                  <span className="font-medium text-foreground">{item.title}</span>
                  {item.requiresReview && " · needs manager review"}
                  <span className="block">{item.officialLegend}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
