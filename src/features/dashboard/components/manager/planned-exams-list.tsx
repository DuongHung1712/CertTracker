import Link from "next/link";
import { Calendar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getPlannedExams } from "@/features/dashboard/manager-metrics";
import type { RecordRow } from "@/features/records/queries";
import { formatDate } from "@/lib/format";
import { daysLeftLabel } from "@/lib/plural";
import { getInitials } from "@/lib/initials";

export function PlannedExamsList({ records }: { records: RecordRow[] }) {
  const exams = getPlannedExams(records, 60);

  if (exams.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-center">
        <Calendar className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-body font-medium text-foreground">No upcoming exams</p>
        <p className="text-caption text-muted-foreground">
          No planned exam dates set within the next 60 days.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {exams.map((exam) => (
        <div
          key={exam.recordId}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/30"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground font-mono text-caption font-semibold"
            >
              {getInitials(exam.memberName)}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-body font-medium text-foreground truncate">{exam.memberName}</span>
              <span className="text-caption text-muted-foreground truncate">{exam.courseName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex flex-col items-end text-right">
              <span className="font-mono text-caption font-semibold text-foreground">
                {formatDate(exam.plannedExamDate)}
              </span>
              <span className="font-mono text-caption text-[var(--status-expiring-soon-fg)] font-medium">
                {daysLeftLabel(exam.daysRemaining)}
              </span>
            </div>
            <Link
              href={`/records?search=${encodeURIComponent(exam.memberName)}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              View
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
