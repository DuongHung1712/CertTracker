import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { MembersTable } from "@/features/members/components/members-table";
import { listMembers, listTeamOptionsForCurrentUser } from "@/features/members/queries";

export default async function MembersPage() {
  const user = await getCurrentUser();
  const [members, teams] = await Promise.all([listMembers(), listTeamOptionsForCurrentUser()]);
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Thành viên"
        description={isAdmin ? "Toàn bộ thành viên và team của họ." : "Thành viên trong team bạn quản lý."}
      />
      <MembersTable members={members} teams={teams} canCreate={isAdmin} canDelete={isAdmin} />
    </div>
  );
}
