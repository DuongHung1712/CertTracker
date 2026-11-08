export type StatusSegment = {
  key: string;
  label: string;
  count: number;
  color: string;
};

/**
 * Lightweight stacked bar for KPI hero cards and the detail panel.
 * Uses plain semantic HTML with an aria-label text equivalent (no Recharts bundle overhead).
 */
export function StatusBar({
  segments,
  ariaLabel,
  showLabels = false,
}: {
  segments: StatusSegment[];
  ariaLabel?: string;
  showLabels?: boolean;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const activeSegments = segments.filter((s) => s.count > 0);
  const computedAriaLabel =
    ariaLabel ??
    (total === 0 ? "No records" : segments.map((s) => `${s.label}: ${s.count}`).join(", "));

  if (total === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <div
          role="img"
          aria-label={computedAriaLabel}
          className="h-2.5 w-full overflow-hidden rounded-sm bg-muted"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={computedAriaLabel}
        className="flex h-2.5 w-full overflow-hidden rounded-sm bg-muted"
      >
        {activeSegments.map((s) => {
          const pct = (s.count / total) * 100;
          return (
            <div
              key={s.key}
              style={{
                width: `${pct}%`,
                backgroundColor: s.color,
              }}
              className="h-full first:rounded-l-sm last:rounded-r-sm"
              title={`${s.label}: ${s.count}`}
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          {segments.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span>{s.label}</span>
              <span className="font-medium text-foreground tabular-nums">
                {s.count}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
