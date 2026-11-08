const CHIP = "rounded-full px-3.5 py-1 text-caption font-medium";
const SOON_TAB = `inline-flex cursor-not-allowed items-center gap-1.5 border border-dashed border-border bg-muted/30 text-muted-foreground ${CHIP}`;

/** "Overview" is the only live view; the others are disabled chips for features that are not built yet. */
export function DashboardTabStrip({ label, soon }: { label: string; soon: string[] }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <button
        type="button"
        role="tab"
        aria-selected="true"
        className={`bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${CHIP}`}
      >
        Overview
      </button>
      {soon.map((name) => (
        <button key={name} type="button" role="tab" aria-label={`${name} Soon`} aria-selected="false" disabled className={SOON_TAB}>
          <span>{name}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-caption text-muted-foreground">Soon</span>
        </button>
      ))}
    </div>
  );
}
