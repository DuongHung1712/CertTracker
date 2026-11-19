"use client";

import * as React from "react";
import {
  Check,
  CheckCircle2,
  Cpu,
  Layers,
  Search,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import { SKILL_CATEGORIES } from "../schema";
import type { Skill, SkillCategory, SkillLevel, VerificationStatus } from "../types";
import { SkillLegendPopover } from "./skill-legend-popover";
import { SkillQuickRate } from "./skill-quick-rate";
import { Badge } from "@/components/ui/badge";
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
  React.useEffect(() => {
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
  }, [open, skills, allCatalogSkills]);

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
      <DialogContent className="max-w-4xl sm:max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <div>
                <DialogTitle className="text-section-title font-semibold text-foreground">
                  Quick Assess by Domain (Batch Fast-Fill)
                </DialogTitle>
                <DialogDescription className="text-caption text-muted-foreground">
                  Evaluate your technical competencies sequentially across tech stacks without modal friction.
                </DialogDescription>
              </div>
            </div>

            {/* Overall Progress Counter */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-1.5 border border-border/60 self-start sm:self-auto">
              <div className="flex flex-col text-right">
                <span className="font-mono text-[11px] font-semibold text-foreground">
                  {assessedSkills} / {totalSkills} Rated
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {progressPercent}% completed
                </span>
              </div>
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden border border-border/70">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar & Domain Navigation */}
        <div className="border-b border-border bg-muted/20 px-4 py-2.5 flex flex-col gap-2">
          {/* Top row: search & fast actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter stack (e.g. FastAPI, Kafka, Go)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-7 pl-8 text-caption bg-card"
              />
            </div>

            {/* Fast domain bulk actions (only visible when not searching) */}
            {!query && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground mr-1">
                  Domain Actions:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleFastFillDomain(1)}
                  className="h-6 px-2 text-[11px] font-mono"
                  title="Mark all skills in this domain as Level 1 (Know Theory)"
                >
                  Set L1 (Theory)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleFastFillDomain(2)}
                  className="h-6 px-2 text-[11px] font-mono"
                  title="Mark all skills in this domain as Level 2 (Minimal Experience)"
                >
                  Set L2 (Exp)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMatchDomainTargets}
                  className="h-6 px-2 text-[11px] font-mono text-primary hover:border-primary/40"
                  title="Set all skills in this domain to role target"
                >
                  Match Targets
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFastFillDomain(0)}
                  className="h-6 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                  title="Reset domain skills to Level 0 (None)"
                >
                  Clear (L0)
                </Button>
              </div>
            )}
          </div>

          {/* Domain Category Tabs */}
          {!query && (
            <div className="overflow-x-auto pb-0.5">
              <Tabs
                value={activeCategory}
                onValueChange={(val) => setActiveCategory(val as SkillCategory)}
                className="w-full"
              >
                <TabsList className="h-8 w-full justify-start gap-1 bg-transparent p-0">
                  {SKILL_CATEGORIES.map((cat) => {
                    const stats = domainCounts[cat.id] || { total: 0, assessed: 0 };
                    return (
                      <TabsTrigger
                        key={cat.id}
                        value={cat.id}
                        className="h-7 rounded-sm px-2.5 text-[11px] font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
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
        <div className="flex-1 overflow-y-auto max-h-[55vh] bg-card">
          <table className="w-full text-left text-table">
            <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 backdrop-blur-xs">
              <tr>
                <th className="px-3 py-1.5 text-label uppercase text-muted-foreground font-semibold w-24">
                  Code
                </th>
                <th className="px-3 py-1.5 text-label uppercase text-muted-foreground font-semibold">
                  Skill &amp; Framework
                </th>
                <th className="px-3 py-1.5 text-label uppercase text-muted-foreground font-semibold w-28">
                  Role Target
                </th>
                <th className="px-3 py-1.5 text-label uppercase text-muted-foreground font-semibold w-48">
                  <div className="inline-flex items-center gap-1">
                    <span>Quick-Rate (0–5)</span>
                    <SkillLegendPopover align="end" side="bottom" />
                  </div>
                </th>
                <th className="px-3 py-1.5 text-label uppercase text-muted-foreground font-semibold w-28 text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedSkills.map((skill) => {
                const meetsTarget = skill.currentLevel >= skill.targetLevel;
                const delta = skill.currentLevel - skill.targetLevel;

                return (
                  <tr
                    key={skill.id}
                    className="group h-8 hover:bg-accent/40 transition-colors"
                  >
                    {/* Code */}
                    <td className="px-3 py-1 font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      <span className="vault-mono-tag">{skill.code}</span>
                    </td>

                    {/* Name & Short Description */}
                    <td className="px-3 py-1 max-w-sm">
                      <div className="flex flex-col">
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
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
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
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <span>Tip: Click any number 0–5 or use keyboard arrow keys.</span>
            {hasChanges && (
              <span className="text-primary font-medium">● Unsaved edits in memory</span>
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
