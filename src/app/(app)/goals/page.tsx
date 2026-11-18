import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { QuarterlyTargetCard } from "@/features/dashboard/components/member/quarterly-target-card";

export default async function GoalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.memberId) redirect("/dashboard");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Quarterly goals"
        description="Set a certificate goal for each quarter and follow it with your team."
      />
      <div className="max-w-2xl">
        <QuarterlyTargetCard />
      </div>
    </div>
  );
}
