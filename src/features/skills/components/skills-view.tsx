"use client";

import * as React from "react";
import { LayoutGrid, Table } from "lucide-react";
import { toast } from "sonner";
import {
  batchSaveSkillAssessments,
  quickRateSkill,
  removeMemberSkill,
  reviewMemberSkill,
  saveSkillAssessment,
} from "../actions";
import { calculateSkillStats, filterSkills, getCategoryCounts, rateSkill, sortSkills } from "../metrics";
import { LEVEL_SCALE_GUIDE, SKILL_CATEGORIES } from "../schema";
import type {
  PendingSkillReview,
  Skill,
  SkillCategory,
  SkillLevel,
  SkillSortOption,
  SkillVerificationFilter,
  SkillsWorkspaceData,
} from "../types";
import { SkillAssessmentDialog, type SkillAssessmentUpdate } from "./skill-assessment-dialog";
import { SkillBatchAssessDialog } from "./skill-batch-assess-dialog";
import { SkillCard } from "./skill-card";
import { SkillDetailDialog } from "./skill-detail-dialog";
import { SkillLevelGuide } from "./skill-level-guide";
import { SkillReviewDialog, type SkillReviewTarget } from "./skill-review-dialog";
import { SKILL_STATUS_LABEL } from "./skill-status";
import { SkillsHeader } from "./skills-header";
import { SkillTable } from "./skill-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayVn } from "@/lib/dates";
import { pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: SelectOption[] = [
  { id: "all", name: "All statuses" },
  { id: "certified", name: SKILL_STATUS_LABEL.certified },
  { id: "pending_review", name: SKILL_STATUS_LABEL.pending_review },
  { id: "returned", name: SKILL_STATUS_LABEL.returned },
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

const SAVE_CONNECTION_ERROR = "Could not save. Check your connection and try again.";

function levelToast(skill: Skill, level: SkillLevel) {
  toast.success(
    level === 5
      ? `${skill.name} set to level 5, waiting for manager review`
      : `${skill.name} set to level ${level} (${LEVEL_SCALE_GUIDE[level].title})`,
  );
}

export interface SkillsViewProps {
  workspace: Extract<SkillsWorkspaceData, { status: "ok" }>;
  viewerHasMemberProfile?: boolean;
}

export function SkillsView({ workspace, viewerHasMemberProfile = false }: SkillsViewProps) {
  const [catalogSkills, setCatalogSkills] = React.useState<Skill[]>(workspace.catalogSkills);
  const [prevWorkspaceCatalog, setPrevWorkspaceCatalog] = React.useState(workspace.catalogSkills);
  const [pendingReviews, setPendingReviews] = React.useState<PendingSkillReview[]>(workspace.pendingReviews);
  const [prevWorkspacePending, setPrevWorkspacePending] = React.useState(workspace.pendingReviews);

  if (workspace.catalogSkills !== prevWorkspaceCatalog) {
    setPrevWorkspaceCatalog(workspace.catalogSkills);
    setCatalogSkills(workspace.catalogSkills);
  }

  if (workspace.pendingReviews !== prevWorkspacePending) {
    setPrevWorkspacePending(workspace.pendingReviews);
    setPendingReviews(workspace.pendingReviews);
  }

  const [category, setCategory] = React.useState<"all" | SkillCategory>("all");
  const [status, setStatus] = React.useState<SkillVerificationFilter>("all");
  const [query, setQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SkillSortOption>("level-desc");
  const [viewMode, setViewMode] = React.useState<"grid" | "table">("table");

  const [guideOpen, setGuideOpen] = React.useState(false);
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [detailSkillId, setDetailSkillId] = React.useState<string | null>(null);
  const [assessSkill, setAssessSkill] = React.useState<Skill | null>(null);
  const [returnTarget, setReturnTarget] = React.useState<SkillReviewTarget | null>(null);
  const [reviewingKey, setReviewingKey] = React.useState<string | null>(null);

  const detailSkill = React.useMemo(
    () => (detailSkillId ? (catalogSkills.find((s) => s.id === detailSkillId) ?? null) : null),
    [catalogSkills, detailSkillId],
  );

  const mySkills = React.useMemo(() => catalogSkills.filter((s) => s.isSaved), [catalogSkills]);
  const categoryCounts = React.useMemo(() => getCategoryCounts(mySkills), [mySkills]);
  const stats = React.useMemo(() => calculateSkillStats(mySkills), [mySkills]);
  const visibleSkills = React.useMemo(
    () => sortSkills(filterSkills(mySkills, { category, verification: status, query }), sortBy),
    [mySkills, category, status, query, sortBy],
  );

  async function handleQuickRate(skillId: string, level: SkillLevel) {
    if (!workspace.canEdit) return;
    const skill = catalogSkills.find((s) => s.id === skillId);
    if (!skill) return;

    const previousSkill = skill;
    const updatedSkill: Skill = { ...rateSkill(skill, level, todayVn()), isSaved: true };
    setCatalogSkills((prev) => prev.map((s) => (s.id === skillId ? updatedSkill : s)));

    try {
      const result = await quickRateSkill({ skillId, level });
      if (!result.ok) {
        setCatalogSkills((prev) => prev.map((s) => (s.id === skillId ? previousSkill : s)));
        toast.error(result.error, { duration: Infinity });
        return;
      }
      levelToast(skill, level);
    } catch {
      setCatalogSkills((prev) => prev.map((s) => (s.id === skillId ? previousSkill : s)));
      toast.error(SAVE_CONNECTION_ERROR, { duration: Infinity });
    }
  }

  async function handleSaveAssessment({
    skillId,
    newLevel,
    yearsOfExperience,
    evidenceNote,
  }: SkillAssessmentUpdate): Promise<boolean> {
    if (!workspace.canEdit) return false;
    const skill = catalogSkills.find((s) => s.id === skillId);
    if (!skill) return false;

    try {
      const result = await saveSkillAssessment({
        skillId,
        newLevel,
        yearsOfExperience,
        evidenceNote: evidenceNote || null,
      });
      if (!result.ok) {
        toast.error(result.error, { duration: Infinity });
        return false;
      }

      const updatedSkill: Skill = {
        ...rateSkill(skill, newLevel, todayVn()),
        yearsOfExperience,
        evidenceNote: evidenceNote || undefined,
        isSaved: true,
      };
      setCatalogSkills((prev) => prev.map((s) => (s.id === skillId ? updatedSkill : s)));
      levelToast(skill, newLevel);
      return true;
    } catch {
      toast.error(SAVE_CONNECTION_ERROR, { duration: Infinity });
      return false;
    }
  }

  async function handleRemoveSkill(skillId: string): Promise<boolean> {
    if (!workspace.canEdit) return false;
    const skill = catalogSkills.find((s) => s.id === skillId);
    if (!skill) return false;

    try {
      const result = await removeMemberSkill({ skillId });
      if (!result.ok) {
        toast.error(result.error, { duration: Infinity });
        return false;
      }

      const resetSkill: Skill = {
        ...skill,
        currentLevel: 0,
        verification: "self_assessed",
        yearsOfExperience: 0,
        lastEvaluatedAt: "",
        evidenceNote: undefined,
        reviewNote: undefined,
        reviewedByName: undefined,
        reviewedAt: undefined,
        isSaved: false,
      };
      setCatalogSkills((prev) => prev.map((s) => (s.id === skillId ? resetSkill : s)));
      setDetailSkillId((prev) => (prev === skillId ? null : prev));
      toast.success(`Removed ${skill.name} from your skills`);
      return true;
    } catch {
      toast.error(SAVE_CONNECTION_ERROR, { duration: Infinity });
      return false;
    }
  }

  async function handleBatchSave(changedSkills: Skill[]): Promise<boolean> {
    if (!workspace.canEdit || changedSkills.length === 0) return false;

    try {
      const result = await batchSaveSkillAssessments({
        items: changedSkills.map((s) => ({ skillId: s.id, level: s.currentLevel })),
      });
      if (!result.ok) {
        toast.error(result.error, { duration: Infinity });
        return false;
      }

      const byId = new Map(changedSkills.map((s) => [s.id, { ...s, isSaved: true }]));
      setCatalogSkills((prev) => prev.map((s) => byId.get(s.id) ?? s));
      toast.success(`Saved ${pluralize(changedSkills.length, "skill rating")}`);
      return true;
    } catch {
      toast.error(SAVE_CONNECTION_ERROR, { duration: Infinity });
      return false;
    }
  }

  async function submitReview({
    memberId,
    skillId,
    skillName,
    decision,
    note,
  }: {
    memberId: string;
    skillId: string;
    skillName: string;
    decision: "approve" | "return";
    note?: string;
  }): Promise<boolean> {
    const key = `${memberId}:${skillId}`;
    setReviewingKey(key);
    try {
      const result = await reviewMemberSkill({ memberId, skillId, decision, note });
      if (!result.ok) {
        toast.error(result.error, { duration: Infinity });
        return false;
      }

      setPendingReviews((prev) =>
        prev.filter((item) => !(item.memberId === memberId && item.skillId === skillId)),
      );

      if (memberId === workspace.targetMember.id) {
        setCatalogSkills((prev) =>
          prev.map((s) => {
            if (s.id !== skillId) return s;
            if (decision === "approve") {
              return { ...s, verification: "certified", reviewNote: undefined };
            }
            return { ...s, currentLevel: 4, verification: "returned", reviewNote: note };
          }),
        );
      }

      toast.success(
        decision === "approve"
          ? `Approved ${skillName} at Level 5`
          : `Returned ${skillName} for changes`,
      );
      return true;
    } catch {
      toast.error("Could not save the review. Check your connection and try again.", { duration: Infinity });
      return false;
    } finally {
      setReviewingKey(null);
    }
  }

  function handleApproveSkill(skill: Skill) {
    void submitReview({
      memberId: workspace.targetMember.id,
      skillId: skill.id,
      skillName: skill.name,
      decision: "approve",
    });
  }

  function handleOpenReturnForSkill(skill: Skill) {
    setReturnTarget({
      memberId: workspace.targetMember.id,
      memberName: workspace.targetMember.fullName,
      skillId: skill.id,
      skillName: skill.name,
    });
  }

  function clearFilters() {
    setCategory("all");
    setStatus("all");
    setQuery("");
  }

  const hasActiveFilters = category !== "all" || status !== "all" || query.trim() !== "";
  const visibleCategories = SKILL_CATEGORIES.filter((c) => categoryCounts[c.id]);
  const reviewingSkillId =
    reviewingKey && reviewingKey.startsWith(`${workspace.targetMember.id}:`)
      ? reviewingKey.slice(workspace.targetMember.id.length + 1)
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SkillsHeader
        targetMember={workspace.targetMember}
        isOwnProfile={workspace.isOwnProfile}
        canEdit={workspace.canEdit}
        viewerHasMemberProfile={viewerHasMemberProfile}
        stats={stats}
        benchmark={workspace.benchmark}
        pendingReviews={pendingReviews}
        reviewingKey={reviewingKey}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenBatchAssess={() => setBatchOpen(true)}
        onApproveReview={(review) => {
          void submitReview({
            memberId: review.memberId,
            skillId: review.skillId,
            skillName: review.skillName,
            decision: "approve",
          });
        }}
        onReturnReview={(review) => {
          setReturnTarget({
            memberId: review.memberId,
            memberName: review.memberName,
            skillId: review.skillId,
            skillName: review.skillName,
          });
        }}
      />

      <section aria-label="Skills" className="flex flex-col gap-4">
        {mySkills.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card">
            <EmptyState
              title="No skills rated yet"
              description={
                workspace.canEdit
                  ? "Rate the skills you use to build your profile and link certificates for verified status."
                  : `${workspace.targetMember.fullName} has not rated any skills yet.`
              }
              action={
                workspace.canEdit ? (
                  <Button type="button" size="sm" onClick={() => setBatchOpen(true)}>
                    Update skill rate
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <Tabs value={category} onValueChange={(value) => setCategory(value as "all" | SkillCategory)}>
              <TabsList
                variant="line"
                className="w-full flex-wrap border-b border-border group-data-horizontal/tabs:h-auto"
              >
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
                <div className="w-44">
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
                    canEdit={workspace.canEdit}
                    canReview={workspace.canReview}
                    reviewPending={reviewingSkillId === skill.id}
                    onViewDetails={(s) => setDetailSkillId(s.id)}
                    onAssess={setAssessSkill}
                    onQuickRate={handleQuickRate}
                    onApprove={handleApproveSkill}
                    onReturn={handleOpenReturnForSkill}
                  />
                ))}
              </div>
            ) : (
              <SkillTable
                skills={visibleSkills}
                canEdit={workspace.canEdit}
                canReview={workspace.canReview}
                reviewingSkillId={reviewingSkillId}
                onViewDetails={(s) => setDetailSkillId(s.id)}
                onAssess={setAssessSkill}
                onQuickRate={handleQuickRate}
                onApprove={handleApproveSkill}
                onReturn={handleOpenReturnForSkill}
              />
            )}
          </>
        )}
      </section>

      <SkillLevelGuide open={guideOpen} onOpenChange={setGuideOpen} />

      {workspace.canEdit && (
        <>
          <SkillBatchAssessDialog
            open={batchOpen}
            onOpenChange={setBatchOpen}
            skills={catalogSkills}
            onSave={handleBatchSave}
          />
          <SkillAssessmentDialog
            skill={assessSkill}
            onOpenChange={(open) => !open && setAssessSkill(null)}
            onSave={handleSaveAssessment}
            onRemove={handleRemoveSkill}
          />
        </>
      )}

      <SkillDetailDialog
        skill={detailSkill}
        canEdit={workspace.canEdit}
        canReview={workspace.canReview}
        reviewPending={detailSkill !== null && reviewingSkillId === detailSkill.id}
        onOpenChange={(open) => !open && setDetailSkillId(null)}
        onOpenAssess={setAssessSkill}
        onApprove={handleApproveSkill}
        onReturn={handleOpenReturnForSkill}
      />

      <SkillReviewDialog
        target={returnTarget}
        pending={
          returnTarget !== null && reviewingKey === `${returnTarget.memberId}:${returnTarget.skillId}`
        }
        onOpenChange={(open) => !open && setReturnTarget(null)}
        onConfirmReturn={(note) => {
          if (!returnTarget) return false;
          return submitReview({
            memberId: returnTarget.memberId,
            skillId: returnTarget.skillId,
            skillName: returnTarget.skillName,
            decision: "return",
            note,
          });
        }}
      />
    </div>
  );
}
