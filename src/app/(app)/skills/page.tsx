import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { SkillsView } from "@/features/skills/components/skills-view";

const SKILLS_DESCRIPTION = "Rate each skill from 0 to 5 and back it up with certificates.";

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.memberId) {
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

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="My skills" description={SKILLS_DESCRIPTION} />
      <SkillsView />
    </div>
  );
}
