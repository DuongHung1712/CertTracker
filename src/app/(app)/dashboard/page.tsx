import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { AdminDashboardView } from "@/features/dashboard/components/admin/admin-dashboard-view";
import { ManagerDashboardView } from "@/features/dashboard/components/manager/manager-dashboard-view";
import { MemberDashboardView } from "@/features/dashboard/components/member/member-dashboard-view";
import { UserGuideCard } from "@/features/guide/components/user-guide-card";
import {
  loadAdminDashboard,
  loadManagerDashboard,
  loadMemberDashboard,
} from "@/features/dashboard/load";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ guide?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // The menu's "User guide" opens /dashboard?guide=1: show the guide again even after "Don't show again".
  const { guide } = await searchParams;
  const guideCard = <UserGuideCard userId={user.id} role={user.role} forceOpen={(Array.isArray(guide) ? guide[0] : guide) === "1"} />;

  if (user.role === "member") {
    if (!user.memberId) {
      return (
        <div className="flex min-w-0 flex-col gap-6">
          {guideCard}
          <PageHeader title="Dashboard" description="Personal certificates and progress." />
          <EmptyState
            title="Your account is not linked to a member"
            description="Ask your admin to link your account to a member so your certificates show here."
          />
        </div>
      );
    }
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {guideCard}
        <MemberDashboardView {...(await loadMemberDashboard(user, user.memberId))} />
      </div>
    );
  }

  if (user.role === "manager") {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        {guideCard}
        <ManagerDashboardView {...(await loadManagerDashboard(user))} />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {guideCard}
      <AdminDashboardView {...(await loadAdminDashboard(user))} />
    </div>
  );
}
