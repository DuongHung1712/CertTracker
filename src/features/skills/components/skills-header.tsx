import * as React from "react";
import { Award, CheckCircle, HelpCircle, RotateCcw, Target, TrendingUp, Zap } from "lucide-react";
import type { RoleBenchmark, SkillStats } from "../types";
import { SkillLegendBar } from "./skill-legend-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SkillsHeaderProps {
  stats: SkillStats;
  benchmark: RoleBenchmark;
  onOpenGuide: () => void;
  onFilterGaps: () => void;
  onResetSeed: () => void;
  onOpenBatchAssess?: () => void;
}

export function SkillsHeader({
  stats,
  benchmark,
  onOpenGuide,
  onFilterGaps,
  onResetSeed,
  onOpenBatchAssess,
}: SkillsHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Role Benchmark Banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-label uppercase tracking-wider text-primary font-semibold">
              Standard Target Role
            </span>
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
              {benchmark.roleName}
            </span>
            <span className="text-caption text-muted-foreground">·</span>
            <span className="text-caption text-muted-foreground">{benchmark.teamName}</span>
          </div>
          <p className="text-caption text-muted-foreground line-clamp-1 sm:line-clamp-none">
            {benchmark.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onOpenBatchAssess && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenBatchAssess}
              className="flex items-center gap-1.5 text-caption font-semibold h-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
              title="Quickly rate multiple skills in your stack by domain without modal friction"
            >
              <Zap className="size-3.5" />
              <span>Quick Assess Stack</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 text-caption font-medium h-8"
          >
            <HelpCircle className="size-3.5 text-primary" />
            <span>Scale Guide (0–5)</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetSeed}
            title="Reset demo skills data back to initial seed"
            className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground h-8"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reset Seed</span>
          </Button>
        </div>
      </div>

      {/* Official 0-5 Legend Strip (collapsible reference) */}
      <SkillLegendBar defaultExpanded={false} />

      {/* 4 KPI Summary Cards */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* KPI 1: Overall Competency Index */}
        <div
          data-slot="kpi-tile"
          className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors"
        >
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase text-muted-foreground font-semibold">
              Skill Index
            </dt>
            <TrendingUp className="size-4 text-primary" />
          </div>
          <dd className="mt-2 text-kpi tabular-nums font-semibold tracking-tight text-foreground">
            {stats.averageLevel.toFixed(1)}{" "}
            <span className="text-caption font-normal text-muted-foreground">/ 5.0</span>
          </dd>
          <dd className="mt-1 text-[11px] text-muted-foreground">
            Target benchmark: {benchmark.overallTargetScore.toFixed(1)}
          </dd>
        </div>

        {/* KPI 2: Certified Coverage */}
        <div
          data-slot="kpi-tile"
          className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors"
        >
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase text-muted-foreground font-semibold">
              Certified Skills
            </dt>
            <Award className="size-4 text-primary" />
          </div>
          <dd className="mt-2 text-kpi tabular-nums font-semibold tracking-tight text-foreground">
            {stats.certifiedCount}{" "}
            <span className="text-caption font-normal text-muted-foreground">
              / {stats.totalSkills}
            </span>
          </dd>
          <dd className="mt-1 flex items-center gap-1.5 text-[11px] text-primary font-medium">
            <span className="vault-live-dot vault-dot-emerald" aria-hidden="true" />
            <span>{stats.certifiedPercentage}% verified by exam</span>
          </dd>
        </div>

        {/* KPI 3: Role Benchmark Match */}
        <div
          data-slot="kpi-tile"
          className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors"
        >
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase text-muted-foreground font-semibold">
              Role Match
            </dt>
            <CheckCircle className="size-4 text-primary" />
          </div>
          <dd className="mt-2 text-kpi tabular-nums font-semibold tracking-tight text-foreground">
            {stats.targetMetCount}{" "}
            <span className="text-caption font-normal text-muted-foreground">
              / {stats.totalSkills}
            </span>
          </dd>
          <dd className="mt-1 text-[11px] text-muted-foreground">
            {Math.round((stats.targetMetCount / (stats.totalSkills || 1)) * 100)}% on track for role
          </dd>
        </div>

        {/* KPI 4: Growth Gaps */}
        <div
          data-slot="kpi-tile"
          role={stats.gapCount > 0 ? "button" : undefined}
          tabIndex={stats.gapCount > 0 ? 0 : undefined}
          onClick={stats.gapCount > 0 ? onFilterGaps : undefined}
          onKeyDown={
            stats.gapCount > 0
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFilterGaps();
                  }
                }
              : undefined
          }
          className={cn(
            "flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            stats.gapCount > 0 && "cursor-pointer hover:border-primary/50",
          )}
          title={stats.gapCount > 0 ? "Click to view skills below role benchmark" : undefined}
          aria-label={stats.gapCount > 0 ? "Growth Gaps: Click to filter skills below role benchmark" : undefined}
        >
          <div className="flex items-center justify-between">
            <dt className="text-label uppercase text-muted-foreground font-semibold">
              Growth Gaps
            </dt>
            <Target className="size-4 text-foreground/70" />
          </div>
          <dd className="mt-2 text-kpi tabular-nums font-semibold tracking-tight text-foreground">
            {stats.gapCount}
          </dd>
          <dd className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Below benchmark</span>
            {stats.gapCount > 0 && (
              <span className="text-primary hover:underline font-medium">Filter</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
