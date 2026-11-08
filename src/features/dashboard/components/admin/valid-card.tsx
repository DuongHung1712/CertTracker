import { KpiTile } from "@/features/dashboard/components/admin/kpi-tile";
import { pluralize } from "@/lib/plural";

const RING_SIZE = 36;
const RING_STROKE = 3.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const circumference = Math.PI * 2 * RING_RADIUS;
const PERCENT = 100;

function ValidRing({ rate, label }: { rate: number; label: string }) {
  const center = RING_SIZE / 2;
  const circle = { cx: center, cy: center, r: RING_RADIUS, fill: "none", strokeWidth: RING_STROKE };
  return (
    <svg role="img" aria-label={label} className="size-6 shrink-0" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
      <circle {...circle} className="stroke-primary-foreground/25" />
      <circle
        {...circle}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - rate / PERCENT)}
        strokeLinecap="round"
        className="origin-center -rotate-90 stroke-primary-foreground"
      />
    </svg>
  );
}

function issuedCaption(issuedThisMonth: number | undefined): string | null {
  if (issuedThisMonth === undefined) return null;
  if (issuedThisMonth === 0) return "None issued this month";
  return `${pluralize(issuedThisMonth, "certificate")} issued this month`;
}

/** `issuedThisMonth` is undefined when the records query failed: the caption is then left out. */
export function ValidCard({
  valid,
  completed,
  rate,
  issuedThisMonth,
}: {
  valid: number;
  completed: number;
  rate: number;
  issuedThisMonth: number | undefined;
}) {
  const issued = issuedCaption(issuedThisMonth);

  return (
    <KpiTile
      solid
      label="Valid certificates"
      badge={
        <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 font-mono text-caption font-semibold">
          {`${rate}% valid`}
        </span>
      }
      footer={
        <div className="flex items-center gap-2">
          <ValidRing
            rate={rate}
            label={`Valid certificates: ${valid} of ${completed} completed certificates are still valid (${rate}%)`}
          />
          {issued && <span className="truncate text-caption text-primary-foreground-muted">{issued}</span>}
        </div>
      }
    >
      <dl className="flex items-baseline justify-between gap-2">
        <div>
          <dt className="text-xs text-primary-foreground-muted">Valid</dt>
          <dd className="font-mono text-2xl font-bold tracking-tight">{valid}</dd>
        </div>
        <div className="text-right font-mono text-caption text-primary-foreground-muted">
          <dt className="sr-only">Out of</dt>
          <dd>{`of ${completed} completed`}</dd>
        </div>
      </dl>
    </KpiTile>
  );
}
