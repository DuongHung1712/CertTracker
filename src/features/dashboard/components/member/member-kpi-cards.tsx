import { AlertCircle, ArrowRight, Award, CalendarClock, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { MemberKpis, MemberView } from "@/features/dashboard/member-metrics";
import { formatDate } from "@/lib/format";
import { daysLeftLabel, pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";

/** Keeps the four tiles the same height whatever they hold. */
const KPI_TILE_MIN_HEIGHT = "min-h-[175px]";

type Tone = "primary" | "neutral" | "warning" | "danger";

const TILE_SURFACE: Record<Tone, string> = {
  primary: "border-transparent bg-primary text-primary-foreground",
  neutral: "border-border bg-card",
  warning: "border-[var(--status-expiring-soon-border)] bg-card",
  danger: "border-destructive/30 bg-card",
};
const LABEL_COLOUR: Record<Tone, string> = {
  primary: "text-primary-foreground/80",
  neutral: "text-muted-foreground",
  warning: "text-[var(--status-expiring-soon-fg)]",
  danger: "text-destructive",
};
const VALUE_COLOUR: Record<Tone, string> = {
  primary: "text-primary-foreground",
  neutral: "text-foreground",
  warning: "text-foreground",
  danger: "text-foreground",
};
const MUTED_COLOUR: Record<Tone, string> = {
  primary: "text-primary-foreground/80",
  neutral: "text-muted-foreground",
  warning: "text-muted-foreground",
  danger: "text-muted-foreground",
};

/**
 * One tile. The label is the link (stretched over the whole tile) to /me narrowed to the tile's items, so the
 * number always leads somewhere. `dt` text stays the plain label: the e2e tile lookup matches it exactly.
 */
function Tile({
  label,
  view,
  href,
  tone,
  icon,
  value,
  summary,
  children,
}: {
  label: string;
  view: MemberView;
  href?: string;
  tone: Tone;
  icon: ReactNode;
  value: number;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/tile relative flex min-w-0 flex-col justify-between rounded-lg border p-3.5 transition-colors focus-within:ring-[3px] focus-within:ring-ring/50",
        TILE_SURFACE[tone],
        tone === "primary" ? "hover:bg-primary/90" : "hover:bg-accent/40",
        KPI_TILE_MIN_HEIGHT,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <dt className={cn("min-w-0 truncate font-mono text-label uppercase tracking-wider", LABEL_COLOUR[tone])}>
            <Link
              href={href ?? `/me?view=${view}`}
              className="outline-none after:absolute after:inset-0 after:rounded-lg"
            >
              {label}
            </Link>
          </dt>
          <span className={cn("shrink-0", LABEL_COLOUR[tone])}>{icon}</span>
        </div>
        <dd className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl", VALUE_COLOUR[tone])}>{value}</dd>
        <dd className={cn("min-w-0 truncate text-caption leading-tight", MUTED_COLOUR[tone])} title={summary}>
          {summary}
        </dd>
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1.5 border-t pt-2 text-caption",
          tone === "primary" ? "border-primary-foreground/20" : "border-border",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Last line of a tile: what to do or what is next, with an arrow that nudges on hover. */
function Footer({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span className="flex min-w-0 items-center justify-between gap-1">
      <span className={cn("min-w-0 truncate", strong && "font-medium")}>{children}</span>
      <ArrowRight
        className="size-3 shrink-0 transition-transform group-hover/tile:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </span>
  );
}

export function MemberKpiCards({ kpis }: { kpis: MemberKpis }) {
  const held = kpis.validCount + kpis.completionDoneCount;
  const needsAction = kpis.expiredCount + kpis.expiringCount;
  const hasExpired = kpis.expiredCount > 0;
  const hasExpiring = kpis.expiringCount > 0;
  const progress = kpis.activeInProgress?.progress ?? 0;

  const needsSummary = hasExpired
    ? [pluralize(kpis.expiredCount, "expired exam"), hasExpiring ? `${kpis.expiringCount} expiring` : null].filter(Boolean).join(" · ")
    : hasExpiring
      ? `Next: ${kpis.leastDaysRecord?.certificateName ?? "an exam certificate"}`
      : "Nothing to renew";

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Held"
        view="held"
        tone="primary"
        icon={<Award className="size-3.5" aria-hidden="true" />}
        value={held}
        summary={[
          held > 0
            ? `${pluralize(kpis.validCount, "exam certificate")} · ${pluralize(kpis.completionDoneCount, "course completion")}`
            : "None yet",
          kpis.waitingCount > 0 ? `${kpis.waitingCount} waiting for approval` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <Footer>View all</Footer>
        {kpis.waitingCount > 0 && (
          // `relative` lifts it above the tile's stretched label link.
          <Link href="/me?view=waiting" className="relative w-fit text-caption hover:underline">
            See waiting items
          </Link>
        )}
      </Tile>

      <Tile
        label="Needs action"
        view="needs-action"
        tone={hasExpired ? "danger" : hasExpiring ? "warning" : "neutral"}
        icon={
          hasExpired ? (
            <AlertCircle className="size-3.5" aria-hidden="true" />
          ) : hasExpiring ? (
            <Clock className="size-3.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
          )
        }
        value={needsAction}
        summary={needsSummary}
      >
        {hasExpired ? (
          <Footer strong>Renew first</Footer>
        ) : hasExpiring && kpis.leastDaysRecord ? (
          <Footer strong>{daysLeftLabel(kpis.leastDaysRecord.daysToExpiry)}</Footer>
        ) : (
          <span className="flex items-center gap-1.5 font-medium text-status-active-fg">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            All up to date
          </span>
        )}
      </Tile>

      <Tile
        label="In progress"
        view="in-progress"
        href={kpis.inProgressCount === 0 ? "/courses" : undefined}
        tone="neutral"
        icon={<PlayCircle className="size-3.5 text-primary" aria-hidden="true" />}
        value={kpis.inProgressCount}
        summary={kpis.inProgressCount > 0 ? "Learning items in progress" : "Nothing in progress"}
      >
        {kpis.activeInProgress ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium text-foreground" title={kpis.activeInProgress.certificateName}>
                {kpis.activeInProgress.certificateName}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <Footer>Explore catalogue &rarr;</Footer>
        )}
      </Tile>

      <Tile
        label="Up next"
        view="up-next"
        tone="neutral"
        icon={<CalendarClock className="size-3.5 text-primary" aria-hidden="true" />}
        value={kpis.notStartedCount}
        summary={
          kpis.nextPlanned
            ? kpis.nextPlanned.certificateName
            : kpis.notStartedCount > 0
              ? "No exam date set"
              : "Nothing planned"
        }
      >
        <Footer strong={kpis.nextPlanned !== null}>
          {kpis.nextPlanned?.plannedExamDate
            ? formatDate(kpis.nextPlanned.plannedExamDate)
            : kpis.notStartedCount > 0
              ? "Set a date"
              : "Plan one"}
        </Footer>
      </Tile>
    </dl>
  );
}
