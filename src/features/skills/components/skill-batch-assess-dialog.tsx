"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { categoryLabel, rateSkill } from "../metrics";
import { SKILL_CATEGORIES } from "../schema";
import type { Skill, SkillCategory, SkillLevel } from "../types";
import { SkillLegendPopover } from "./skill-legend-popover";
import { SkillQuickRate } from "./skill-quick-rate";
import { SkillStatus } from "./skill-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SkillBatchAssessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The whole catalogue with the member's ratings already merged in. */
  skills: Skill[];
  onSave: (skills: Skill[]) => void;
}

/** Rate a whole area in one sitting: one row per skill, changes stay local until "Save ratings". */
export function SkillBatchAssessDialog({ open, onOpenChange, skills, onSave }: SkillBatchAssessDialogProps) {
  const [draft, setDraft] = React.useState(skills);
  const [category, setCategory] = React.useState<SkillCategory>("backend");
  const [query, setQuery] = React.useState("");
  const [dirty, setDirty] = React.useState(false);

  // Start every opening from the latest ratings.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(skills);
      setDirty(false);
    }
  }

  const q = query.trim().toLowerCase();
  const rows = q
    ? draft.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    : draft.filter((s) => s.category === category);

  const ratedCount = draft.filter((s) => s.currentLevel > 0).length;
  const countFor = (id: SkillCategory) => {
    const inCategory = draft.filter((s) => s.category === id);
    return `${inCategory.filter((s) => s.currentLevel > 0).length}/${inCategory.length}`;
  };

  function apply(match: (s: Skill) => boolean, level: (s: Skill) => SkillLevel) {
    setDraft((prev) => prev.map((s) => (match(s) ? rateSkill(s, level(s)) : s)));
    setDirty(true);
  }

  function fillCategory(level: (s: Skill) => SkillLevel, message: string) {
    apply((s) => s.category === category, level);
    toast.success(`${categoryLabel(category)}: ${message}`);
  }

  function save() {
    onSave(draft);
    onOpenChange(false);
    toast.success("Ratings saved");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="flex-row items-start justify-between gap-4 border-b border-border py-4 pr-12 pl-5">
          <div className="min-w-0">
            <DialogTitle className="text-section-title">Rate many skills</DialogTitle>
            <DialogDescription>Work through one area at a time. Nothing changes until you save.</DialogDescription>
          </div>
          <p className="shrink-0 text-caption text-muted-foreground tabular-nums">
            {ratedCount} of {draft.length} rated
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-b border-border px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full sm:w-72">
              <Search aria-hidden className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search all skills"
                placeholder="Search all skills, e.g. Kafka"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8"
              />
            </div>
            {!q && (
              <div role="group" aria-label="Set the whole area" className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fillCategory(() => 1, "set to level 1")}>
                  Set all to 1
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => fillCategory(() => 0, "set to level 0")}>
                  Set all to 0
                </Button>
              </div>
            )}
          </div>

          {!q && (
            <Tabs value={category} onValueChange={(value) => setCategory(value as SkillCategory)}>
              <TabsList variant="line" className="w-full flex-wrap group-data-horizontal/tabs:h-auto">
                {SKILL_CATEGORIES.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} className="flex-none">
                    {c.label} <span className="tabular-nums text-muted-foreground">{countFor(c.id)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table className="text-table">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    Your level
                    <SkillLegendPopover align="start" />
                  </span>
                </TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                    No skills match &ldquo;{query}&rdquo;.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((skill) => (
                  <TableRow key={skill.id}>
                    <TableCell className="w-full max-w-0">
                      <span className="block truncate font-medium text-foreground">{skill.name}</span>
                      <span className="block truncate text-caption text-muted-foreground">{skill.description}</span>
                    </TableCell>
                    <TableCell>
                      <SkillQuickRate
                        skillName={skill.name}
                        currentLevel={skill.currentLevel}
                        onRate={(level) => apply((s) => s.id === skill.id, () => level)}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {skill.currentLevel === 0 && skill.verification === "self_assessed" ? (
                        <span className="text-caption text-muted-foreground">Not rated</span>
                      ) : (
                        <SkillStatus status={skill.verification} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-caption text-muted-foreground" aria-live="polite">
            {dirty ? "You have unsaved changes." : "Tip: click a number, or use the arrow keys."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>
              Save ratings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
