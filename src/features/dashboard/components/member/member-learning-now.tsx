"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { updateLearningProgress } from "@/features/learning/actions";
import { learningPath } from "@/features/records/kind";
import type { RecordRow } from "@/features/records/queries";
import { formatDate } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import { clampPercent } from "@/components/status/labels";

/** Items shown on the dashboard; the rest are one click away in My learning. */
const MAX_SHOWN = 5;
const STEPS = [10, 25] as const;
/** Finishing needs a date, so the quick steps stop at 99 and "Done" goes through the form. */
const MAX_QUICK_PROGRESS = 99;

/** Studying first (furthest along first), then what has not started (soonest exam first). */
export function byLearningPriority(a: RecordRow, b: RecordRow): number {
  const aOpen = a.status === "in_progress" ? 0 : 1;
  const bOpen = b.status === "in_progress" ? 0 : 1;
  if (aOpen !== bOpen) return aOpen - bOpen;
  if (aOpen === 0) return b.progress - a.progress;
  return (a.plannedExamDate ?? "9999-12-31").localeCompare(b.plannedExamDate ?? "9999-12-31");
}

/**
 * What the member is learning right now, with +10% / +25% on each so progress is one click, not a form.
 * The rows are the open learning items (decision #72) as journey rows: `id` is the learning item's id.
 */
export function MemberLearningNow({ items, onAdd }: { items: RecordRow[]; onAdd: () => void }) {
  /** A step just taken, kept until the server's new value arrives (`base` says which value it was taken from). */
  const [taken, setTaken] = useState<Record<string, { base: number; value: number }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = [...items].sort(byLearningPriority);
  const shown = sorted.slice(0, MAX_SHOWN);
  const studying = items.filter((item) => item.status === "in_progress").length;
  const progressOf = (item: RecordRow) => (taken[item.id]?.base === item.progress ? taken[item.id].value : item.progress);

  async function step(item: RecordRow, by: number) {
    const from = progressOf(item);
    const next = Math.min(MAX_QUICK_PROGRESS, from + by);
    if (next === from) return;
    setBusyId(item.id);
    setTaken((prev) => ({ ...prev, [item.id]: { base: item.progress, value: next } }));
    // `from` is what the member saw: the server writes only if the item still holds it, so a stale page never lowers newer progress.
    const result = await updateLearningProgress({ id: item.id, progress: next, from });
    setBusyId(null);
    if (result.ok) {
      toast.success(`${item.certificateName}: ${next}%`, { action: { label: "Undo", onClick: () => void undo(item, from, next) } });
    } else {
      setTaken((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== item.id)));
      toast.error(result.error);
    }
  }

  async function undo(item: RecordRow, back: number, from: number) {
    const result = await updateLearningProgress({ id: item.id, progress: back, from });
    if (!result.ok) return void toast.error(result.error);
    setTaken((prev) => ({ ...prev, [item.id]: { base: from, value: back } }));
    toast.success(`${item.certificateName}: back to ${back}%`);
  }

  return (
    <section aria-label="Learning now" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-section-title font-semibold text-foreground">Learning now</h2>
          <p className="text-caption text-muted-foreground">
            {items.length === 0
              ? "Courses and exams you are working on."
              : `${pluralize(studying, "item")} in progress${items.length > studying ? `, ${items.length - studying} not started` : ""}.`}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd} className="gap-1.5">
          <Plus aria-hidden className="size-4" />
          Add learning
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-body text-muted-foreground">
          Nothing yet. Add the course or exam you are working on, then update your progress here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {shown.map((item) => {
            const progress = clampPercent(progressOf(item));
            const path = [
              learningPath(item),
              item.status === "not_started" ? "Not started" : null,
              item.plannedExamDate ? `Exam ${formatDate(item.plannedExamDate)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={item.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-body font-medium text-foreground" title={item.certificateName}>
                      {item.certificateName}
                    </span>
                    {path && <span className="truncate text-caption text-muted-foreground">{path}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {progress >= MAX_QUICK_PROGRESS ? (
                      <Link
                        href="/me?tab=learning"
                        aria-label={`Finish ${item.certificateName} in My learning`}
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                      >
                        Finish
                      </Link>
                    ) : (
                      STEPS.map((by) => (
                        <Button
                          key={by}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === item.id}
                          onClick={() => void step(item, by)}
                          aria-label={`Add ${by}% progress to ${item.certificateName}`}
                          className="tabular-nums"
                        >
                          +{by}%
                        </Button>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    role="progressbar"
                    aria-label={`Progress of ${item.certificateName}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="w-10 text-right text-caption tabular-nums text-foreground">{progress}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/me?tab=learning" className="w-fit text-caption font-medium text-foreground underline underline-offset-2">
        {items.length > shown.length ? `View all ${items.length} in My learning` : "Open My learning"}
      </Link>
    </section>
  );
}
