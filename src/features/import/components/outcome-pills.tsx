import { cn } from "@/lib/utils";
import { ROW_OUTCOME_LABEL, type RowOutcome } from "@/features/import/preview";

export const OUTCOME_ALL = "all";
export type OutcomeFilter = RowOutcome | typeof OUTCOME_ALL;
const OUTCOMES: RowOutcome[] = ["create", "update", "unchanged", "error"];

/** Result counters that double as the result filter; the active pill is `aria-pressed`, clicking it again shows all. */
export function OutcomePills({
  counts,
  total,
  value,
  onChange,
}: {
  counts: Record<RowOutcome, number>;
  total: number;
  value: OutcomeFilter;
  onChange: (value: OutcomeFilter) => void;
}) {
  const pills: { id: OutcomeFilter; label: string; count: number }[] = [
    { id: OUTCOME_ALL, label: "All", count: total },
    ...OUTCOMES.map((outcome) => ({ id: outcome, label: ROW_OUTCOME_LABEL[outcome], count: counts[outcome] })),
  ];
  return (
    <div role="group" aria-label="Filter by result" className="flex flex-wrap gap-2">
      {pills.map(({ id, label, count }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            disabled={count === 0 && !active}
            onClick={() => onChange(active ? OUTCOME_ALL : id)}
            className={cn(
              "inline-flex min-h-8 items-center rounded-full border px-3 text-body tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              id === "error" && !active && count > 0 && "text-destructive",
            )}
          >
            {`${label} ${count}`}
          </button>
        );
      })}
    </div>
  );
}
