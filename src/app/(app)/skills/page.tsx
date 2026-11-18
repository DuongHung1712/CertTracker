import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { SkillsMatrixCard } from "@/features/dashboard/components/member/skills-matrix-card";

export default async function SkillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.memberId) redirect("/dashboard");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="My skills"
        description="See your skill levels next to your team's standards."
      />
      <div className="max-w-2xl">
        <SkillsMatrixCard />
      </div>
    </div>
  );
}
