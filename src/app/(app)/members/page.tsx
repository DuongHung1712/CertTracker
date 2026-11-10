import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { listCareerRoles } from "@/features/career/queries";
import { ImportMembersDialog } from "@/features/members/components/import-members-dialog";
import { MembersTable } from "@/features/members/components/members-table";
import { listMemberScopes, listMembers, listTeamOptionsForCurrentUser, type MemberScope } from "@/features/members/queries";

export default async function MembersPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [members, teams, roles, scopes] = await Promise.all([
    listMembers(),
    listTeamOptionsForCurrentUser(),
    listCareerRoles(),
    isAdmin ? listMemberScopes() : Promise.resolve(new Map<string, MemberScope[]>()),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        description={isAdmin ? "Everyone, with their teams." : "Members of the teams in your scope."}
        actions={isAdmin ? <ImportMembersDialog /> : undefined}
      />
      <MembersTable members={members} teams={teams} roles={roles} canEditCareer={isAdmin} scopes={Object.fromEntries(scopes)} showScopes={isAdmin} canCreate={isAdmin} canDelete={isAdmin} />
    </div>
  );
}
