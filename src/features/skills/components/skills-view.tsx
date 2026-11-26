"use client";

import * as React from "react";
import { LayoutGrid, Table } from "lucide-react";
import { toast } from "sonner";
import { calculateSkillStats, filterSkills, getCategoryCounts, rateSkill, sortSkills } from "../metrics";
import { LEVEL_SCALE_GUIDE, SKILL_CATEGORIES } from "../schema";
import { ENTERPRISE_SKILL_CATALOG, SEED_ROLE_BENCHMARK, SEED_SKILLS } from "../seed-data";
import type {
  RoleBenchmark,
  Skill,
  SkillCategory,
  SkillLevel,
  SkillSortOption,
  SkillVerificationFilter,
} from "../types";
import { SkillAssessmentDialog, type SkillAssessmentUpdate } from "./skill-assessment-dialog";
import { SkillBatchAssessDialog } from "./skill-batch-assess-dialog";
import { SkillCard } from "./skill-card";
import { SkillDetailDialog } from "./skill-detail-dialog";
import { SkillLevelGuide } from "./skill-level-guide";
import { SKILL_STATUS_LABEL } from "./skill-status";
import { SkillsHeader } from "./skills-header";
import { SkillTable } from "./skill-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: SelectOption[] = [
  { id: "all", name: "All statuses" },
  { id: "certified", name: SKILL_STATUS_LABEL.certified },
  { id: "pending_review", name: SKILL_STATUS_LABEL.pending_review },
  { id: "self_assessed", name: SKILL_STATUS_LABEL.self_assessed },
];

const SORT_OPTIONS: SelectOption[] = [
  { id: "level-desc", name: "Highest level first" },
  { id: "level-asc", name: "Lowest level first" },
  { id: "name-asc", name: "Name A–Z" },
  { id: "recent", name: "Recently rated" },
];

const VIEW_MODES = [
  { mode: "grid", label: "Card view", icon: LayoutGrid },
  { mode: "table", label: "Table view", icon: Table },
] as const;

/** The whole catalogue, with the member's own ratings laid over it. */
function mergeWithCatalog(profile: Skill[]): Skill[] {
  const byId = new Map<string, Skill>(ENTERPRISE_SKILL_CATALOG.map((s) => [s.id, s]));
  for (const s of profile) byId.set(s.id, s);
  return Array.from(byId.values());
}

function levelToast(skill: Skill, level: SkillLevel) {
  toast.success(
    level === 5
      ? `${skill.name} set to level 5, waiting for manager review. Preview only: not saved or sent yet`
      : `${skill.name} set to level ${level} (${LEVEL_SCALE_GUIDE[level].title})`,
  );
}

interface SkillsViewProps {
  initialSkills?: Skill[];
  benchmark?: RoleBenchmark;
}

export function SkillsView({ initialSkills = SEED_SKILLS, benchmark = SEED_ROLE_BENCHMARK }: SkillsViewProps) {
  // shortcut: mock state in memory, lost on reload; replace with queries/actions when Skills leaves Later.
  const [allSkills, setAllSkills] = React.useState<Skill[]>(() => mergeWithCatalog(initialSkills));
  const [profileIds, setProfileIds] = React.useState<Set<string>>(() => new Set(initialSkills.map((s) => s.id)));

  const [category, setCategory] = React.useState<"all" | SkillCategory>("all");
  const [status, setStatus] = React.useState<SkillVerificationFilter>("all");
  const [query, setQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SkillSortOption>("level-desc");
  const [viewMode, setViewMode] = React.useState<"grid" | "table">("grid");

  const [guideOpen, setGuideOpen] = React.useState(false);
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [detailSkill, setDetailSkill] = React.useState<Skill | null>(null);
  const [assessSkill, setAssessSkill] = React.useState<Skill | null>(null);

  const mySkills = React.useMemo(
    () => allSkills.filter((s) => profileIds.has(s.id)),
    [allSkills, profileIds],
  );
  const categoryCounts = React.useMemo(() => getCategoryCounts(mySkills), [mySkills]);
  const stats = React.useMemo(() => calculateSkillStats(mySkills), [mySkills]);
  const visibleSkills = React.useMemo(
    () => sortSkills(filterSkills(mySkills, { category, verification: status, query }), sortBy),
    [mySkills, category, status, query, sortBy],
  );

  function updateSkill(skill: Skill, change: (s: Skill) => Skill, level: SkillLevel) {
    setAllSkills((prev) => prev.map((s) => (s.id === skill.id ? change(s) : s)));
    levelToast(skill, level);
  }

  function handleQuickRate(skillId: string, level: SkillLevel) {
    const skill = allSkills.find((s) => s.id === skillId);
    if (skill) updateSkill(skill, (s) => rateSkill(s, level), level);
  }

  function handleSaveAssessment({ skillId, newLevel, yearsOfExperience, evidenceNote }: SkillAssessmentUpdate) {
    const skill = allSkills.find((s) => s.id === skillId);
    if (!skill) return;
    updateSkill(
      skill,
      (s) => ({ ...rateSkill(s, newLevel), yearsOfExperience, evidenceNote: evidenceNote || undefined }),
      newLevel,
    );
  }

  function handleBatchSave(nextSkills: Skill[]) {
    setProfileIds((prev) => {
      const next = new Set(prev);
      for (const s of nextSkills) {
        if (s.currentLevel > 0) next.add(s.id);
      }
      return next;
    });
    setAllSkills(nextSkills);
  }

  function clearFilters() {
    setCategory("all");
    setStatus("all");
    setQuery("");
  }

  const hasActiveFilters = category !== "all" || status !== "all" || query.trim() !== "";
  const visibleCategories = SKILL_CATEGORIES.filter((c) => categoryCounts[c.id]);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SkillsHeader
        stats={stats}
        benchmark={benchmark}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenBatchAssess={() => setBatchOpen(true)}
      />

      <section aria-label="Skills" className="flex flex-col gap-4">
        <Tabs value={category} onValueChange={(value) => setCategory(value as "all" | SkillCategory)}>
          <TabsList variant="line" className="w-full flex-wrap border-b border-border group-data-horizontal/tabs:h-auto">
            <TabsTrigger value="all" className="flex-none">
              All skills <span className="tabular-nums text-muted-foreground">{categoryCounts.all ?? 0}</span>
            </TabsTrigger>
            {visibleCategories.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="flex-none">
                {c.label} <span className="tabular-nums text-muted-foreground">{categoryCounts[c.id]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterBar
            search={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search skills or certificates"
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
          >
            <div className="w-40">
              <OptionSelect
                id="skills-status"
                value={status}
                onChange={(value) => setStatus(value as SkillVerificationFilter)}
                options={STATUS_OPTIONS}
                placeholder="Status"
              />
            </div>
            <div className="w-44">
              <OptionSelect
                id="skills-sort"
                value={sortBy}
                onChange={(value) => setSortBy(value as SkillSortOption)}
                options={SORT_OPTIONS}
                placeholder="Sort"
              />
            </div>
          </FilterBar>

          <div role="group" aria-label="View" className="inline-flex rounded-md border border-border bg-muted p-0.5">
            {VIEW_MODES.map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                aria-label={label}
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  viewMode === mode && "bg-card text-foreground shadow-xs",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </button>
            ))}
          </div>
        </div>

        {visibleSkills.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-10">
            <EmptyState
              title="No skills match these filters"
              description="Try another category or status, or clear the search."
            />
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onViewDetails={setDetailSkill}
                onAssess={setAssessSkill}
                onQuickRate={handleQuickRate}
              />
            ))}
          </div>
        ) : (
          <SkillTable
            skills={visibleSkills}
            onViewDetails={setDetailSkill}
            onAssess={setAssessSkill}
            onQuickRate={handleQuickRate}
          />
        )}
      </section>

      <SkillLevelGuide open={guideOpen} onOpenChange={setGuideOpen} />
      <SkillBatchAssessDialog open={batchOpen} onOpenChange={setBatchOpen} skills={allSkills} onSave={handleBatchSave} />
      <SkillDetailDialog
        skill={detailSkill}
        onOpenChange={(open) => !open && setDetailSkill(null)}
        onOpenAssess={setAssessSkill}
      />
      <SkillAssessmentDialog
        skill={assessSkill}
        onOpenChange={(open) => !open && setAssessSkill(null)}
        onSave={handleSaveAssessment}
      />
    </div>
  );
}
