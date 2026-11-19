import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { SkillsView } from "@/features/skills/components/skills-view";

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.memberId) redirect("/dashboard");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="My skills"
        description="See your skill levels next to your team's standards and prove competency through certifications."
      />
      <SkillsView />
    </div>
  );
}
