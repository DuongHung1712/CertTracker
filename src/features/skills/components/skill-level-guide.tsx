import * as React from "react";
import { CheckCircle2, Info, ShieldAlert, Sparkles } from "lucide-react";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { SkillLevel } from "../types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SkillLevelGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillLevelGuide({ open, onOpenChange }: SkillLevelGuideProps) {
  const levels: SkillLevel[] = [0, 1, 2, 3, 4, 5];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Info className="size-5 text-primary" />
            <DialogTitle className="text-section-title">
              Engineering Skill Competency Scale (0–5)
            </DialogTitle>
          </div>
          <DialogDescription className="text-caption text-muted-foreground">
            Standard DC34 skill evaluation matrix. Defines competency expectations and certification verification standards.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Level 5 Notice Banner */}
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-body">
            <Sparkles className="size-5 shrink-0 text-primary mt-0.5" />
            <div className="flex flex-col gap-1 text-caption">
              <span className="font-semibold text-foreground">
                Level 5 (DC Master) Governance Rule
              </span>
              <p className="text-muted-foreground">
                Levels 0 through 4 can be self-assessed or proved via approved industry certifications. Level 5 (DC Master) represents departmental authority and requires formal review and endorsement by your DC Manager.
              </p>
            </div>
          </div>

          {/* Scale Breakdown */}
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {levels.map((lvl) => {
              const item = LEVEL_SCALE_GUIDE[lvl];
              const isMaster = lvl === 5;
              const isExpert = lvl === 4;

              return (
                <div
                  key={lvl}
                  className={cn(
                    "flex flex-col gap-1.5 p-3.5 transition-colors sm:flex-row sm:items-start sm:gap-4",
                    isMaster && "bg-primary/5",
                  )}
                >
                  <div className="flex shrink-0 items-center gap-2 sm:w-36">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-label font-bold uppercase",
                        "vault-mono-tag",
                        isMaster
                          ? "bg-primary text-primary-foreground"
                          : isExpert
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : lvl >= 2
                              ? "bg-muted text-foreground border border-border"
                              : "bg-muted/70 text-muted-foreground",
                      )}
                    >
                      {item.badgeLabel}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-1 text-caption">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {item.title} ({item.percentageRange}) — {item.officialLegend}
                      </span>
                      {isMaster ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                          <ShieldAlert className="size-3" />
                          Manager Approval Req.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CheckCircle2 className="size-3 text-primary" />
                          Cert or Self-assessment
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {item.criteria}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
