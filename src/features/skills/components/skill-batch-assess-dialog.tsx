"use client";

import * as React from "react";
import { RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { rateSkill } from "../metrics";
import { SKILL_CATEGORIES } from "../schema";
import type { Skill, SkillCategory, SkillLevel } from "../types";
import { SkillLegendPopover } from "./skill-legend-popover";
import { SkillQuickRate } from "./skill-quick-rate";
import { SkillStatus } from "./skill-status";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { foldText } from "@/lib/text";
import { cn } from "@/lib/utils";

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
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [missingIds, setMissingIds] = React.useState<Set<string>>(() => new Set());
  const [focusSkillId, setFocusSkillId] = React.useState<string | null>(null);
  const rowRefs = React.useRef(new Map<string, HTMLTableRowElement>());

  // Start every opening from the latest ratings.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(skills);
      setDirty(false);
      setConfirmDiscard(false);
      setMissingIds(new Set());
      setFocusSkillId(null);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && dirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  }

  // Scroll to and focus the first missing row after any tab/search switch settles.
  React.useEffect(() => {
    if (!focusSkillId) return;
    const rowEl = rowRefs.current.get(focusSkillId);
    if (rowEl) {
      rowEl.scrollIntoView?.({ behavior: "smooth", block: "center" });
      rowEl.querySelector<HTMLElement>('[role="radio"]')?.focus();
      setFocusSkillId(null);
    }
  }, [focusSkillId, category, query]);

  const q = foldText(query);
  const rows = q
    ? draft.filter((s) => foldText(`${s.name} ${s.description}`).includes(q))
    : draft.filter((s) => s.category === category);

  const ratedCount = draft.filter((s) => s.currentLevel > 0).length;
  const countFor = (id: SkillCategory) => {
    const inCategory = draft.filter((s) => s.category === id);
    return `${inCategory.filter((s) => s.currentLevel > 0).length}/${inCategory.length}`;
  };
  const hasMissingInCategory = (id: SkillCategory) =>
    missingIds.size > 0 && draft.some((s) => s.category === id && missingIds.has(s.id));

  function rateOne(skillId: string, level: SkillLevel) {
    setDraft((prev) => prev.map((s) => (s.id === skillId ? rateSkill(s, level) : s)));
    setDirty(true);
    if (missingIds.has(skillId) && level > 0) {
      setMissingIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    }
  }

  function resetRatings() {
    setDraft(skills);
    setDirty(false);
    setMissingIds(new Set());
    setFocusSkillId(null);
    toast.success("Ratings reset");
  }

  function save() {
    const unrated = draft.filter((s) => s.currentLevel === 0);
    if (unrated.length > 0) {
      const nextMissing = new Set(unrated.map((s) => s.id));
      setMissingIds(nextMissing);
      const firstMissing = rows.find((s) => nextMissing.has(s.id)) ?? unrated[0];
      if (!rows.some((s) => s.id === firstMissing.id)) {
        setQuery("");
        setCategory(firstMissing.category);
      }
      setFocusSkillId(firstMissing.id);
      return;
    }
    onSave(draft);
    onOpenChange(false);
    toast.success("Ratings saved");
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="xl" scrollable={false} className="h-[85dvh]">
        <DialogHeader className="shrink-0 flex-row items-start justify-between gap-4 border-b border-border py-4 pr-12 pl-5">
          <div className="min-w-0">
            <DialogTitle className="text-section-title">Update skill rate</DialogTitle>
            <DialogDescription>Work through one area at a time. Nothing changes until you save.</DialogDescription>
          </div>
          <p className="shrink-0 text-caption text-muted-foreground tabular-nums">
            {ratedCount} of {draft.length} rated
          </p>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 py-3">
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
            <Button type="button" variant="outline" size="sm" disabled={!dirty} onClick={resetRatings}>
              <RotateCcw aria-hidden className="size-3.5" />
              Reset
            </Button>
          </div>

          {!q && (
            <Tabs value={category} onValueChange={(value) => setCategory(value as SkillCategory)}>
              <TabsList
                variant="line"
                className="flex h-auto w-full flex-wrap items-center gap-x-1 gap-y-1 overflow-visible p-0 group-data-horizontal/tabs:h-auto"
              >
                {SKILL_CATEGORIES.map((c) => (
                  <TabsTrigger
                    key={c.id}
                    value={c.id}
                    className="h-auto flex-none py-1.5 group-data-horizontal/tabs:after:bottom-0"
                  >
                    {c.label}{" "}
                    <span
                      className={cn(
                        "tabular-nums",
                        hasMissingInCategory(c.id) ? "font-semibold text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {countFor(c.id)}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
            {rows.length > 0 && (
              <TableBody>
                {rows.map((skill) => {
                  const isMissing = missingIds.has(skill.id);
                  return (
                    <TableRow
                      key={skill.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(skill.id, el);
                        else rowRefs.current.delete(skill.id);
                      }}
                      data-missing={isMissing ? "true" : undefined}
                      className={cn(isMissing && "bg-destructive/5")}
                    >
                      <TableCell className="w-full max-w-0">
                        <span className={cn("block truncate font-medium", isMissing ? "text-destructive" : "text-foreground")}>
                          {skill.name}
                        </span>
                        <span className="block truncate text-caption text-muted-foreground">{skill.description}</span>
                      </TableCell>
                      <TableCell>
                        <div className={cn("inline-block rounded-md", isMissing && "p-0.5 ring-1 ring-destructive")}>
                          <SkillQuickRate
                            skillName={skill.name}
                            currentLevel={skill.currentLevel}
                            onRate={(level) => rateOne(skill.id, level)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {isMissing ? (
                          <span className="text-caption font-medium text-destructive">Required</span>
                        ) : skill.currentLevel === 0 && skill.verification === "self_assessed" ? (
                          <span className="text-caption text-muted-foreground">Not rated</span>
                        ) : (
                          <SkillStatus status={skill.verification} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            )}
          </Table>
          {rows.length === 0 && (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-body text-muted-foreground">
              No skills match &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3">
          {missingIds.size > 0 ? (
            <p role="alert" className="text-caption font-medium text-destructive">
              {`Rate all missing skills before saving (${missingIds.size} left).`}
            </p>
          ) : (
            <p className="text-caption text-muted-foreground" aria-live="polite">
              {dirty ? "You have unsaved changes." : "Tip: click a number, or use the arrow keys."}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>
              Save ratings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <DiscardChangesDialog
      open={confirmDiscard}
      onOpenChange={setConfirmDiscard}
      onDiscard={() => {
        setConfirmDiscard(false);
        setDirty(false);
        onOpenChange(false);
      }}
    />
    </>
  );
}
