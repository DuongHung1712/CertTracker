import Link from "next/link";
import { ArrowLeft, HelpCircle, ListChecks } from "lucide-react";
import { categoryLabel } from "../metrics";
import type { PendingSkillReview, RoleBenchmark, SkillStats, SkillsWorkspaceMember } from "../types";
import { KpiTile } from "@/components/data/kpi-tile";
import { MemberCode } from "@/components/status/member-code";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/plural";

interface PendingSkillReviewsSectionProps {
  reviews: PendingSkillReview[];
  reviewingKey?: string | null;
  onApprove: (review: PendingSkillReview) => void;
  onReturn: (review: PendingSkillReview) => void;
}

export function PendingSkillReviewsSection({
  reviews,
  reviewingKey = null,
  onApprove,
  onReturn,
}: PendingSkillReviewsSectionProps) {
  if (reviews.length === 0) return null;

  return (
    <section
      aria-label="Waiting for your review"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-section-title font-semibold text-foreground">
          Waiting for your review ({reviews.length})
        </h2>
        <p className="text-caption text-muted-foreground">
          Level 5 requests require manager or admin endorsement.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {reviews.map((review) => {
          const itemKey = `${review.memberId}:${review.skillId}`;
          const isPending = reviewingKey === itemKey;
          return (
            <li
              key={review.id}
              className="flex flex-col gap-3 py-3 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2 text-body">
                  <Link
                    href={`/skills?memberId=${review.memberId}`}
                    className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {review.memberName}
                  </Link>
                  <MemberCode code={review.memberCode} />
                  {review.teamName && (
                    <span className="text-caption text-muted-foreground">· {review.teamName}</span>
                  )}
                </div>
                <p className="text-caption font-medium text-foreground">
                  {review.skillName}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {categoryLabel(review.category)} · {pluralize(review.yearsOfExperience, "year")}
                  </span>
                </p>
                {review.evidenceNote && (
                  <p className="text-caption text-muted-foreground">{review.evidenceNote}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onReturn(review)}
                >
                  Return
                  <span className="sr-only">
                    {" "}
                    {review.skillName} for {review.memberName}
                  </span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onApprove(review)}
                >
                  Approve
                  <span className="sr-only">
                    {" "}
                    {review.skillName} for {review.memberName}
                  </span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface SkillsHeaderProps {
  targetMember: SkillsWorkspaceMember;
  isOwnProfile: boolean;
  canEdit: boolean;
  viewerHasMemberProfile?: boolean;
  stats: SkillStats;
  benchmark: RoleBenchmark;
  pendingReviews?: PendingSkillReview[];
  reviewingKey?: string | null;
  onOpenGuide: () => void;
  onOpenBatchAssess: () => void;
  onApproveReview?: (review: PendingSkillReview) => void;
  onReturnReview?: (review: PendingSkillReview) => void;
}

/** The member's role, page-level actions, optional manager review queue, and four KPI summary tiles. */
export function SkillsHeader({
  targetMember,
  isOwnProfile,
  canEdit,
  viewerHasMemberProfile = false,
  stats,
  benchmark,
  pendingReviews = [],
  reviewingKey = null,
  onOpenGuide,
  onOpenBatchAssess,
  onApproveReview,
  onReturnReview,
}: SkillsHeaderProps) {
  const ofTotal = `of ${pluralize(stats.totalSkills, "skill")}`;

  return (
    <section aria-label="Summary" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          {!isOwnProfile && (
            <div className="flex flex-wrap items-center gap-3 text-caption">
              <Link
                href="/members"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                Back to Members
              </Link>
              {viewerHasMemberProfile && (
                <Link href="/skills" className="font-medium text-muted-foreground hover:text-foreground hover:underline">
                  View my skills
                </Link>
              )}
            </div>
          )}

          {isOwnProfile ? (
            <>
              <h2 className="text-section-title text-foreground">
                {benchmark.roleName}
                <span className="font-normal text-muted-foreground"> · {benchmark.teamName}</span>
              </h2>
              <p className="max-w-prose text-caption text-muted-foreground">
                {targetMember.fullName} · {targetMember.code} · {benchmark.experienceLevel}
              </p>
            </>
          ) : (
            <>
              <h2 className="flex flex-wrap items-center gap-2 text-section-title text-foreground">
                <span>{targetMember.fullName}</span>
                <MemberCode code={targetMember.code} />
              </h2>
              <p className="max-w-prose text-caption text-muted-foreground">
                {benchmark.roleName} · {benchmark.teamName} · {benchmark.experienceLevel}
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenGuide}>
            <HelpCircle aria-hidden />
            Level guide
          </Button>
          {canEdit && stats.totalSkills > 0 && (
            <Button type="button" size="sm" onClick={onOpenBatchAssess}>
              <ListChecks aria-hidden />
              Update skill rate
            </Button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Average level" value={stats.averageLevel.toFixed(1)} hint="on a 0–5 scale" />
        <KpiTile label="Level 4 or higher" value={stats.strongCount} hint={ofTotal} />
        <KpiTile
          label="Certified"
          value={stats.certifiedCount}
          hint={`${ofTotal} · ${stats.certifiedPercentage}%`}
          verified={stats.certifiedCount > 0}
        />
        <KpiTile
          label="Waiting for review"
          value={stats.pendingReviewCount}
          hint={isOwnProfile ? "level 5 needs manager review" : "level 5 awaiting endorsement"}
        />
      </dl>

      {isOwnProfile && pendingReviews.length > 0 && onApproveReview && onReturnReview && (
        <PendingSkillReviewsSection
          reviews={pendingReviews}
          reviewingKey={reviewingKey}
          onApprove={onApproveReview}
          onReturn={onReturnReview}
        />
      )}
    </section>
  );
}
