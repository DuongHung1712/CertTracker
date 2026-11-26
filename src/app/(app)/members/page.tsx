import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { listCareerRoles } from "@/features/career/queries";
import { SectionError } from "@/features/dashboard/components/section";
import { settle } from "@/features/dashboard/settle";
import { ImportMembersDialog } from "@/features/members/components/import-members-dialog";
import { MembersTable } from "@/features/members/components/members-table";
import { listMemberScopes, listMembers, listTeamOptionsForCurrentUser, type MemberScope } from "@/features/members/queries";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const { search } = await searchParams;
  const user = await getCurrentUser();
  // UX only: RLS gives a Member no update right here; /me is their screen.
  if (user?.role === "member") redirect("/me");
  const isAdmin = user?.role === "admin";
  const [members, teams, roles, scopes] = await Promise.all([
    settle(listMembers()),
    settle(listTeamOptionsForCurrentUser()),
    settle(listCareerRoles()),
    isAdmin ? settle(listMemberScopes()) : Promise.resolve({ ok: true as const, data: new Map<string, MemberScope[]>() }),
  ]);

  // Data Quality links open the list already searched (?search=<name>); the key remounts the table when it changes.
  const initialSearch = (Array.isArray(search) ? search[0] : search) ?? "";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Members"
        description={isAdmin ? "Everyone, with their teams." : "Members of the teams in your scope."}
        actions={isAdmin ? <ImportMembersDialog /> : undefined}
      />
      {members.ok && teams.ok && roles.ok && scopes.ok ? (
        <MembersTable
          key={initialSearch}
          initialSearch={initialSearch}
          members={members.data}
          teams={teams.data}
          roles={roles.data}
          canEditCareer={isAdmin}
          scopes={Object.fromEntries(scopes.data)}
          showScopes={isAdmin}
          canCreate={isAdmin}
          canDelete={isAdmin}
        />
      ) : (
        <SectionError title="Members" />
      )}
    </div>
  );
}
