import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { AdminDashboard } from "@/features/dashboard/components/admin-dashboard";
import { MemberDashboardView } from "@/features/dashboard/components/member/member-dashboard-view";
import { loadAdminDashboard, loadMemberDashboard } from "@/features/dashboard/load";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "member") {
    if (!user.memberId) {
      return (
        <div className="flex min-w-0 flex-col gap-6">
          <PageHeader title="Dashboard" description="Personal certificates and progress." />
          <EmptyState
            title="Your account is not linked to a member"
            description="Ask an admin to link your account to a member so your certificates show here."
          />
        </div>
      );
    }
    return <MemberDashboardView {...(await loadMemberDashboard(user, user.memberId))} />;
  }

  return <AdminDashboard role={user.role} data={await loadAdminDashboard()} />;
}
