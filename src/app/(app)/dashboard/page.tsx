import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { AdminDashboardView } from "@/features/dashboard/components/admin/admin-dashboard-view";
import { ManagerDashboardView } from "@/features/dashboard/components/manager/manager-dashboard-view";
import { MemberDashboardView } from "@/features/dashboard/components/member/member-dashboard-view";
import { UserGuideCard } from "@/features/guide/components/user-guide-card";
import { guideVisibleFrom } from "@/features/guide/cookies";
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
  const forceOpen = (Array.isArray(guide) ? guide[0] : guide) === "1";
  // The cookies tell the server whether the guide shows, so it is in the first paint or not at all (no pop-in).
  const jar = await cookies();
  const guideProps = { userId: user.id, role: user.role, forceOpen, initialVisible: guideVisibleFrom((name) => jar.has(name), user.id) };

  if (user.role === "member") {
    if (!user.memberId) {
      return (
        <div className="flex min-w-0 flex-col gap-6">
          <PageHeader title="Dashboard" description="Personal certificates and progress." />
          <UserGuideCard {...guideProps} />
          <EmptyState
            title="Your account is not linked to a member"
            description="Ask your admin to link your account to a member so your certificates show here."
          />
        </div>
      );
    }
    return <MemberDashboardView {...(await loadMemberDashboard(user, user.memberId))} guide={guideProps} />;
  }

  if (user.role === "manager") {
    return <ManagerDashboardView {...(await loadManagerDashboard(user))} guide={guideProps} />;
  }

  return <AdminDashboardView {...(await loadAdminDashboard(user))} guide={guideProps} />;
}
