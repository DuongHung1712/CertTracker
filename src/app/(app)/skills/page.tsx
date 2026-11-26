import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/queries";
import { UnlinkedPendingReviews } from "@/features/skills/components/skill-review-dialog";
import { SkillsRealtime } from "@/features/skills/components/skills-realtime";
import { SkillsView } from "@/features/skills/components/skills-view";
import { listPendingSkillReviews, loadSkillsWorkspace } from "@/features/skills/queries";

const SKILLS_DESCRIPTION = "Rate each skill from 0 to 5 and back it up with certificates.";

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const resolvedParams = await searchParams;
  const rawMemberId = resolvedParams?.memberId;
  const requestedMemberId = (Array.isArray(rawMemberId) ? rawMemberId[0] : rawMemberId)?.trim() || null;

  if (user.role === "member" && requestedMemberId && requestedMemberId !== user.memberId) {
    redirect("/skills");
  }

  if (!user.memberId && !requestedMemberId) {
    if (user.role === "admin" || user.role === "manager") {
      const pendingReviews = await listPendingSkillReviews(null);
      return (
        <div className="flex min-w-0 flex-col gap-6">
          <PageHeader title="My skills" description={SKILLS_DESCRIPTION} />
          <SkillsRealtime />
          <UnlinkedPendingReviews initialReviews={pendingReviews} />
          <EmptyState
            title="Choose a member in Members to view their skills"
            description="Your account is not linked to a member profile yet. Open Members to inspect or review a team member."
            action={
              <Link href="/members" className={buttonVariants({ size: "sm" })}>
                Open Members
              </Link>
            }
          />
        </div>
      );
    }

    return (
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title="My skills" description={SKILLS_DESCRIPTION} />
        <EmptyState
          title="Your account is not linked to a member"
          description="Ask your admin to link your account to a member so your skills show here."
        />
      </div>
    );
  }

  const workspace = await loadSkillsWorkspace({
    viewer: { role: user.role, memberId: user.memberId },
    targetMemberId: requestedMemberId || null,
  });

  if (workspace.status === "not_found") {
    const backHref = user.role === "member" ? "/dashboard" : "/members";
    const backLabel = user.role === "member" ? "Back to Dashboard" : "Back to Members";
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title="Skills" description="Member skill profile." />
        <EmptyState
          title="Member not found"
          description="This member does not exist or is outside your scope."
          action={
            <Link href={backHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {backLabel}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title={workspace.isOwnProfile ? "My skills" : `Skills · ${workspace.targetMember.fullName}`}
        description={
          workspace.isOwnProfile
            ? SKILLS_DESCRIPTION
            : "Review ratings, verified certificates, and Level 5 requests."
        }
      />
      <SkillsRealtime />
      <SkillsView workspace={workspace} viewerHasMemberProfile={Boolean(user.memberId)} />
    </div>
  );
}
