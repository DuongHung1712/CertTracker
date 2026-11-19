"use client";

import * as React from "react";
import {
  LayoutGrid,
  Plus,
  Search,
  Table,
  X,
  Zap,
} from "lucide-react";
import { calculateSkillStats, filterSkills, getCategoryCounts, sortSkills } from "../metrics";
import { LEVEL_SCALE_GUIDE, SKILL_CATEGORIES } from "../schema";
import { ENTERPRISE_SKILL_CATALOG, SEED_ROLE_BENCHMARK, SEED_SKILLS } from "../seed-data";
import type {
  RoleBenchmark,
  Skill,
  SkillCategory,
  SkillLevel,
  SkillSortOption,
  SkillVerificationFilter,
  VerificationStatus,
} from "../types";
import { SkillAssessmentDialog } from "./skill-assessment-dialog";
import { SkillBatchAssessDialog } from "./skill-batch-assess-dialog";
import { SkillCard } from "./skill-card";
import { SkillDetailDialog } from "./skill-detail-dialog";
import { SkillLevelGuide } from "./skill-level-guide";
import { SkillsHeader } from "./skills-header";
import { SkillTable } from "./skill-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SkillsViewProps {
  initialSkills?: Skill[];
  benchmark?: RoleBenchmark;
}

export function SkillsView({
  initialSkills = SEED_SKILLS,
  benchmark = SEED_ROLE_BENCHMARK,
}: SkillsViewProps) {
  // Master skills state containing all catalog skills overlaid with initial user profile skills
  const [allSkills, setAllSkills] = React.useState<Skill[]>(() => {
    const map = new Map<string, Skill>();
    for (const item of ENTERPRISE_SKILL_CATALOG) {
      map.set(item.id, { ...item });
    }
    for (const item of initialSkills) {
      map.set(item.id, { ...item });
    }
    return Array.from(map.values());
  });

  const profileSkillIds = React.useMemo(
    () => new Set(initialSkills.map((s) => s.id)),
    [initialSkills],
  );

  const [selectedCategory, setSelectedCategory] = React.useState<"all" | SkillCategory>("all");
  const [verificationFilter, setVerificationFilter] = React.useState<SkillVerificationFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [sortBy, setSortBy] = React.useState<SkillSortOption>("gap-desc");
  const [viewMode, setViewMode] = React.useState<"grid" | "table">("grid");
  const [catalogScope, setCatalogScope] = React.useState<"profile" | "enterprise">("profile");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Dialog states
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [batchAssessOpen, setBatchAssessOpen] = React.useState(false);
  const [detailSkill, setDetailSkill] = React.useState<Skill | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [assessSkill, setAssessSkill] = React.useState<Skill | null>(null);
  const [assessOpen, setAssessOpen] = React.useState(false);

  // Active skills based on current catalog scope (profile vs enterprise)
  const activeSkills = React.useMemo(() => {
    if (catalogScope === "profile") {
      return allSkills.filter((s) => profileSkillIds.has(s.id));
    }
    return allSkills;
  }, [allSkills, catalogScope, profileSkillIds]);

  // Category counts based on active scope skills
  const categoryCounts = React.useMemo(() => getCategoryCounts(activeSkills), [activeSkills]);

  // Filtered and sorted skills
  const filteredSkills = React.useMemo(() => {
    const matched = filterSkills(activeSkills, {
      category: selectedCategory,
      verification: verificationFilter,
      query: searchQuery,
    });
    return sortSkills(matched, sortBy);
  }, [activeSkills, selectedCategory, verificationFilter, searchQuery, sortBy]);

  // Metric stats calculated from active scope skills
  const stats = React.useMemo(() => calculateSkillStats(activeSkills), [activeSkills]);

  // Handlers
  function handleOpenDetails(skill: Skill) {
    setDetailSkill(skill);
    setDetailOpen(true);
  }

  function handleOpenAssess(skill: Skill) {
    setAssessSkill(skill);
    setAssessOpen(true);
  }

  function handleQuickAssessDefault() {
    // Pick the first skill that has a gap, or the first skill in the active list
    const candidate = activeSkills.find((s) => s.currentLevel < s.targetLevel) || activeSkills[0];
    if (candidate) {
      handleOpenAssess(candidate);
    }
  }

  // 1-Click Inline Quick-Rate Handler
  function handleQuickRate(skillId: string, newLevel: SkillLevel) {
    const targetSkill = allSkills.find((s) => s.id === skillId);
    if (!targetSkill) return;

    const isLevel5 = newLevel === 5;
    let verification: VerificationStatus;
    if (isLevel5) {
      verification = "pending_review";
    } else if (targetSkill.certifiedProof) {
      verification = "certified";
    } else {
      verification = "self_assessed";
    }

    setAllSkills((prev) =>
      prev.map((s) => {
        if (s.id !== skillId) return s;
        return {
          ...s,
          currentLevel: newLevel,
          verification,
          lastEvaluatedAt: new Date().toISOString().slice(0, 10),
        };
      }),
    );

    if (isLevel5) {
      toast.success(
        `Requested Level 5 (DC Master) review from DC Manager for ${targetSkill.name}`,
      );
    } else {
      toast.success(
        `Updated ${targetSkill.name} to Level ${newLevel} (${LEVEL_SCALE_GUIDE[newLevel].title})`,
      );
    }
  }

  function handleSaveAssessment(updated: {
    skillId: string;
    newLevel: SkillLevel;
    yearsOfExperience: number;
    evidenceNote: string;
    isManagerReview: boolean;
  }) {
    setAllSkills((prev) =>
      prev.map((s) => {
        if (s.id !== updated.skillId) return s;
        let verification: VerificationStatus;
        if (updated.isManagerReview) {
          verification = "pending_review";
        } else if (s.certifiedProof) {
          verification = "certified";
        } else {
          verification = "self_assessed";
        }

        return {
          ...s,
          currentLevel: updated.newLevel,
          yearsOfExperience: updated.yearsOfExperience,
          evidenceNote: updated.evidenceNote || s.evidenceNote,
          verification,
          lastEvaluatedAt: new Date().toISOString().slice(0, 10),
        };
      }),
    );
  }

  function handleSaveBatch(updatedSkills: Skill[]) {
    setAllSkills(updatedSkills);
  }

  function handleToggleCatalogScope(scope: "profile" | "enterprise") {
    setCatalogScope(scope);
    if (scope === "enterprise") {
      toast.info("Loaded full 65-skill enterprise tech stack catalog");
    } else {
      toast.info("Switched to core role profile (16 skills)");
    }
  }

  function handleResetSeed() {
    const map = new Map<string, Skill>();
    for (const item of ENTERPRISE_SKILL_CATALOG) {
      map.set(item.id, { ...item });
    }
    for (const item of initialSkills) {
      map.set(item.id, { ...item });
    }
    setAllSkills(Array.from(map.values()));
    setSelectedCategory("all");
    setVerificationFilter("all");
    setSearchQuery("");
    setSortBy("gap-desc");
    setCatalogScope("profile");
    toast.info("Reset skills data to initial demo seed");
  }

  function handleClearFilters() {
    setSelectedCategory("all");
    setVerificationFilter("all");
    setSearchQuery("");
    searchInputRef.current?.focus();
  }

  const isFiltered =
    selectedCategory !== "all" ||
    verificationFilter !== "all" ||
    Boolean(searchQuery.trim());

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* KPI Header & Benchmark Banner */}
      <SkillsHeader
        stats={stats}
        benchmark={benchmark}
        onOpenGuide={() => setGuideOpen(true)}
        onFilterGaps={() => {
          setSelectedCategory("all");
          setVerificationFilter("gaps_only");
        }}
        onResetSeed={handleResetSeed}
        onOpenBatchAssess={() => setBatchAssessOpen(true)}
      />

      {/* Category Tabs */}
      <div className="flex items-center overflow-x-auto border-b border-border pb-1">
        <Tabs
          value={selectedCategory}
          onValueChange={(val) => setSelectedCategory(val as "all" | SkillCategory)}
          className="w-full"
        >
          <TabsList className="h-9 w-full justify-start gap-1 bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="h-8 rounded-md px-3 text-caption font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              All Skills
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                {categoryCounts.all || 0}
              </span>
            </TabsTrigger>

            {SKILL_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="h-8 rounded-md px-3 text-caption font-medium whitespace-nowrap data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                >
                  {cat.label}
                  {count > 0 && (
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Search skills, certs, or domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-8 text-caption"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Right: Filters, Scope, Sort, and View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Catalog Scope Switcher */}
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => handleToggleCatalogScope("profile")}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                catalogScope === "profile"
                  ? "bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Standard Senior Engineer Profile (16 skills)"
            >
              Profile ({profileSkillIds.size})
            </button>
            <button
              type="button"
              onClick={() => handleToggleCatalogScope("enterprise")}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                catalogScope === "enterprise"
                  ? "bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Full Enterprise Stack Catalog (65 skills)"
            >
              Full Stack ({allSkills.length})
            </button>
          </div>

          {/* Verification Status Filter */}
          <div className="w-36">
            <Select
              value={verificationFilter}
              onValueChange={(val) => setVerificationFilter(val as SkillVerificationFilter)}
            >
              <SelectTrigger className="h-8 text-caption">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verification</SelectItem>
                <SelectItem value="certified">Certified Only</SelectItem>
                <SelectItem value="self_assessed">Self-Assessed</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="gaps_only">Role Gaps Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By Dropdown */}
          <div className="w-40">
            <Select
              value={sortBy}
              onValueChange={(val) => setSortBy(val as SkillSortOption)}
            >
              <SelectTrigger className="h-8 text-caption">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gap-desc">Sort: Priority Gaps</SelectItem>
                <SelectItem value="level-desc">Level: High to Low</SelectItem>
                <SelectItem value="level-asc">Level: Low to High</SelectItem>
                <SelectItem value="name-asc">Name: A to Z</SelectItem>
                <SelectItem value="recent">Recently Evaluated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button (shown only when a filter is active) */}
          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 px-2 text-caption font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5 mr-1" />
              <span>Clear filters</span>
            </Button>
          )}

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded px-2 py-1 text-muted-foreground transition-colors hover:text-foreground",
                viewMode === "grid" && "bg-card text-foreground shadow-xs",
              )}
              title="Card Grid View"
              aria-label="Grid view"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded px-2 py-1 text-muted-foreground transition-colors hover:text-foreground",
                viewMode === "table" && "bg-card text-foreground shadow-xs",
              )}
              title="Compact Table View"
              aria-label="Table view"
            >
              <Table className="size-3.5" />
            </button>
          </div>

          {/* Quick Assess by Domain (Batch Fast-Fill) Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBatchAssessOpen(true)}
            className="flex items-center gap-1.5 h-8 font-medium hover:border-primary/40 hover:bg-primary/5"
            title="Batch Fast-Fill Mode across technical domains"
          >
            <Zap className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Fast-Fill</span>
          </Button>

          {/* Assess Skill Button */}
          <Button
            type="button"
            size="sm"
            onClick={handleQuickAssessDefault}
            className="flex items-center gap-1.5 h-8 font-medium"
          >
            <Plus className="size-3.5" />
            <span>Assess Skill</span>
          </Button>
        </div>
      </div>

      {/* Content Area: Grid vs Table vs Empty State */}
      {filteredSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
          <EmptyState
            title="No skills match your filters"
            description="Try adjusting your category, verification status, or search query to find skills."
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="mt-4"
          >
            Clear all filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onViewDetails={handleOpenDetails}
              onAssess={handleOpenAssess}
              onQuickRate={handleQuickRate}
            />
          ))}
        </div>
      ) : (
        <SkillTable
          skills={filteredSkills}
          onViewDetails={handleOpenDetails}
          onAssess={handleOpenAssess}
          onQuickRate={handleQuickRate}
        />
      )}

      {/* Dialogs */}
      <SkillLevelGuide
        open={guideOpen}
        onOpenChange={setGuideOpen}
      />

      <SkillBatchAssessDialog
        open={batchAssessOpen}
        onOpenChange={setBatchAssessOpen}
        skills={allSkills}
        allCatalogSkills={ENTERPRISE_SKILL_CATALOG}
        onSaveBatch={handleSaveBatch}
      />

      <SkillDetailDialog
        skill={detailSkill}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onOpenAssess={handleOpenAssess}
      />

      <SkillAssessmentDialog
        skill={assessSkill}
        open={assessOpen}
        onOpenChange={setAssessOpen}
        onSaveAssessment={handleSaveAssessment}
      />
    </div>
  );
}
