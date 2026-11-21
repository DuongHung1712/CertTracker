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
        description="Rate each skill from 0 to 5 and back it up with certificates."
      />
      <SkillsView />
    </div>
  );
}
