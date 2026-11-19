"use client";

import * as React from "react";
import {
  Check,
  Search,
  Zap,
} from "lucide-react";
import { SKILL_CATEGORIES } from "../schema";
import type { Skill, SkillCategory, SkillLevel, VerificationStatus } from "../types";
import { SkillLegendPopover } from "./skill-legend-popover";
import { SkillQuickRate } from "./skill-quick-rate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SkillBatchAssessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skills: Skill[];
  allCatalogSkills: Skill[];
  onSaveBatch: (updatedSkills: Skill[]) => void;
}

export function SkillBatchAssessDialog({
  open,
  onOpenChange,
  skills,
  allCatalogSkills,
  onSaveBatch,
}: SkillBatchAssessDialogProps) {
  // Merge current skills with catalog: current skills take precedence by ID
  const [workingSkills, setWorkingSkills] = React.useState<Skill[]>(() => {
    const map = new Map<string, Skill>();
    // Start with catalog skills
    for (const c of allCatalogSkills) {
      map.set(c.id, { ...c });
    }
    // Overlay user's evaluated skills
    for (const s of skills) {
      map.set(s.id, { ...s });
    }
    return Array.from(map.values());
  });

  const [activeCategory, setActiveCategory] = React.useState<SkillCategory>("backend");
  const [query, setQuery] = React.useState<string>("");
  const [hasChanges, setHasChanges] = React.useState<boolean>(false);

  // Sync state whenever dialog opens with latest skills
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const map = new Map<string, Skill>();
      for (const c of allCatalogSkills) {
        map.set(c.id, { ...c });
      }
      for (const s of skills) {
        map.set(s.id, { ...s });
      }
      setWorkingSkills(Array.from(map.values()));
      setHasChanges(false);
    }
  }

  // Filter skills for active category and optional query
  const displayedSkills = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return workingSkills.filter((s) => {
      if (q) {
        const matchesQuery =
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q);
        return matchesQuery;
      }
      return s.category === activeCategory;
    });
  }, [workingSkills, activeCategory, query]);

  // Overall assessment stats
  const totalSkills = workingSkills.length;
  const assessedSkills = workingSkills.filter((s) => s.currentLevel > 0).length;
  const progressPercent = totalSkills > 0 ? Math.round((assessedSkills / totalSkills) * 100) : 0;

  // Domain counts
  const domainCounts = React.useMemo(() => {
    const counts: Record<string, { total: number; assessed: number }> = {};
    for (const cat of SKILL_CATEGORIES) {
      counts[cat.id] = { total: 0, assessed: 0 };
    }
    for (const s of workingSkills) {
      if (!counts[s.category]) {
        counts[s.category] = { total: 0, assessed: 0 };
      }
      counts[s.category].total++;
      if (s.currentLevel > 0) {
        counts[s.category].assessed++;
      }
    }
    return counts;
  }, [workingSkills]);

  function handleRateSingle(skillId: string, newLevel: SkillLevel) {
    setWorkingSkills((prev) =>
      prev.map((s) => {
        if (s.id !== skillId) return s;
        const isMaster = newLevel === 5;
        const verification: VerificationStatus = isMaster
          ? "pending_review"
          : s.certifiedProof
            ? "certified"
            : "self_assessed";

        return {
          ...s,
          currentLevel: newLevel,
          verification,
          lastEvaluatedAt: new Date().toISOString().slice(0, 10),
        };
      }),
    );
    setHasChanges(true);
  }

  // Fast-fill actions for the currently active domain
  function handleFastFillDomain(level: SkillLevel) {
    setWorkingSkills((prev) =>
      prev.map((s) => {
        if (s.category !== activeCategory) return s;
        // Only update unrated or all in domain
        const isMaster = level === 5;
        const verification: VerificationStatus = isMaster
          ? "pending_review"
          : s.certifiedProof
            ? "certified"
            : "self_assessed";

        return {
          ...s,
          currentLevel: level,
          verification,
          lastEvaluatedAt: new Date().toISOString().slice(0, 10),
        };
      }),
    );
    setHasChanges(true);
    toast.success(`Set domain skills to Level ${level}`);
  }

  function handleMatchDomainTargets() {
    setWorkingSkills((prev) =>
      prev.map((s) => {
        if (s.category !== activeCategory) return s;
        const target = s.targetLevel;
        const isMaster = target === 5;
        const verification: VerificationStatus = isMaster
          ? "pending_review"
          : s.certifiedProof
            ? "certified"
            : "self_assessed";

        return {
          ...s,
          currentLevel: target,
          verification,
          lastEvaluatedAt: new Date().toISOString().slice(0, 10),
        };
      }),
    );
    setHasChanges(true);
    toast.success(`Matched role targets for ${activeCategory.replace("_", " & ")}`);
  }

  function handleSaveAndClose() {
    onSaveBatch(workingSkills);
    setHasChanges(false);
    onOpenChange(false);
    toast.success(`Saved assessments across ${workingSkills.length} skills`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:w-full sm:max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 py-3 border-b border-border bg-card/60 backdrop-blur-xs shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                <Zap className="size-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-section-title font-semibold text-foreground tracking-tight">
                  Quick Assess Stack
                </DialogTitle>
                <DialogDescription className="text-caption text-muted-foreground truncate hidden sm:block">
                  Fast-fill and evaluate competency levels across engineering domains.
                </DialogDescription>
              </div>
            </div>

            {/* Overall Progress Counter */}
            <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-1 shrink-0 self-start sm:self-auto">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground tabular-nums">
                <span>{assessedSkills} / {totalSkills} Rated</span>
                <span className="text-[10px] text-muted-foreground font-normal">({progressPercent}%)</span>
              </div>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden border border-border/70">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar & Domain Navigation */}
        <div className="border-b border-border bg-muted/20 px-5 py-2 flex flex-col gap-2 shrink-0">
          {/* Top row: search & fast actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter stack (e.g. FastAPI, Kafka, Go)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-caption bg-card"
              />
            </div>

            {/* Fast domain bulk actions (only visible when not searching) */}
            {!query && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline">
                  Domain Actions:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleFastFillDomain(1)}
                  className="h-7 px-2.5 text-[11px] font-mono hover:bg-accent"
                  title="Mark all skills in this domain as Level 1 (Know Theory)"
                  aria-label="Set L1 (Theory)"
                >
                  Set all L1
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMatchDomainTargets}
                  className="h-7 px-2.5 text-[11px] font-mono text-primary hover:border-primary/40 hover:bg-primary/5"
                  title="Set all skills in this domain to role target"
                >
                  Match Targets
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFastFillDomain(0)}
                  className="h-7 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                  title="Reset domain skills to Level 0 (None)"
                  aria-label="Clear (L0)"
                >
                  Clear (L0)
                </Button>
              </div>
            )}
          </div>

          {/* Domain Category Tabs */}
          {!query && (
            <div className="overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Tabs
                value={activeCategory}
                onValueChange={(val) => setActiveCategory(val as SkillCategory)}
                className="w-full"
              >
                <TabsList className="h-8 w-max justify-start gap-1 bg-transparent p-0">
                  {SKILL_CATEGORIES.map((cat) => {
                    const stats = domainCounts[cat.id] || { total: 0, assessed: 0 };
                    return (
                      <TabsTrigger
                        key={cat.id}
                        value={cat.id}
                        className="h-7 rounded-sm px-2.5 text-[11px] font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-colors"
                      >
                        {cat.label}
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                          {stats.assessed}/{stats.total}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>

        {/* Matrix Table Area */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 bg-card">
          <table className="w-full text-left text-table border-collapse">
            <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-xs">
              <tr>
                <th className="px-3 py-2 text-label uppercase text-muted-foreground font-semibold w-24 shrink-0">
                  Code
                </th>
                <th className="px-3 py-2 text-label uppercase text-muted-foreground font-semibold min-w-[200px]">
                  Skill &amp; Framework
                </th>
                <th className="px-3 py-2 text-label uppercase text-muted-foreground font-semibold w-24 shrink-0">
                  Role Target
                </th>
                <th className="px-3 py-2 text-label uppercase text-muted-foreground font-semibold w-48 shrink-0">
                  <div className="inline-flex items-center gap-1.5">
                    <span>Quick-Rate (0–5)</span>
                    <SkillLegendPopover align="end" side="bottom" />
                  </div>
                </th>
                <th className="px-3 py-2 text-label uppercase text-muted-foreground font-semibold w-20 shrink-0 text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedSkills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-caption text-muted-foreground">
                    No skills found matching &quot;{query}&quot;. Try a different search term.
                  </td>
                </tr>
              ) : (
                displayedSkills.map((skill) => {
                  const meetsTarget = skill.currentLevel >= skill.targetLevel;
                  const delta = skill.currentLevel - skill.targetLevel;

                  return (
                    <tr
                      key={skill.id}
                      className="group h-10 hover:bg-accent/40 transition-colors"
                    >
                      {/* Code */}
                      <td className="px-3 py-1 font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                        <span className="vault-mono-tag">{skill.code}</span>
                      </td>

                      {/* Name & Short Description */}
                      <td className="px-3 py-1 min-w-[200px]">
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground text-[12px] truncate">
                            {skill.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate leading-tight">
                            {skill.description}
                          </span>
                        </div>
                      </td>

                      {/* Role Target */}
                      <td className="px-3 py-1 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-foreground">
                            L{skill.targetLevel}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-mono",
                              meetsTarget ? "text-primary font-medium" : "text-muted-foreground",
                            )}
                          >
                            {meetsTarget ? (delta > 0 ? `+${delta}` : "Met") : `${delta}`}
                          </span>
                        </div>
                      </td>

                      {/* 1-Click Inline Quick-Rate Pill Bar */}
                      <td className="px-3 py-1 whitespace-nowrap">
                        <SkillQuickRate
                          skillId={skill.id}
                          skillName={skill.name}
                          currentLevel={skill.currentLevel}
                          targetLevel={skill.targetLevel}
                          onRate={(lvl) => handleRateSingle(skill.id, lvl)}
                          size="sm"
                        />
                      </td>

                      {/* Status */}
                      <td className="px-3 py-1 text-right whitespace-nowrap font-mono text-[11px]">
                        {skill.verification === "certified" ? (
                          <span className="inline-flex items-center gap-1 text-primary font-semibold text-[10px]">
                            <span className="vault-live-dot vault-dot-emerald" aria-hidden="true" />
                            <span>CERT</span>
                          </span>
                        ) : skill.verification === "pending_review" ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground text-[10px]">
                            <span className="vault-live-dot vault-dot-amber" aria-hidden="true" />
                            <span>REVIEW</span>
                          </span>
                        ) : skill.currentLevel > 0 ? (
                          <span className="text-muted-foreground text-[10px]">SELF</span>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px]">UNRATED</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:px-6 sm:py-3 border-t border-border bg-card shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <span className="hidden sm:inline">Tip: Click any number 0–5 or use keyboard arrow keys.</span>
            {hasChanges && (
              <span className="inline-flex items-center gap-1.5 text-primary font-medium text-[11px]">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                <span>Unsaved edits in memory</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAndClose}
              className="h-8 flex items-center gap-1.5 font-medium"
            >
              <Check className="size-3.5" />
              <span>Apply Assessments</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
