import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { DcSection } from "@/features/organizations/components/dc-section";
import { ProgramSection } from "@/features/organizations/components/program-section";
import { TeamSection } from "@/features/organizations/components/team-section";
import { listDcs, listManagerCandidates, listPrograms, listTeamManagerIds, listTeams } from "@/features/organizations/queries";

export default async function OrgPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [dcs, programs, teamRows, candidates] = await Promise.all([
    listDcs(),
    listPrograms(),
    listTeams(),
    listManagerCandidates(),
  ]);
  const teams = await Promise.all(
    teamRows.map(async (team) => ({ ...team, managerIds: await listTeamManagerIds(team.id) })),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tổ chức" description="Trung tâm, chương trình và team." />
      <DcSection dcs={dcs} canManage={isAdmin} />
      <ProgramSection programs={programs} dcs={dcs} canManage={isAdmin} />
      <TeamSection teams={teams} programs={programs} candidates={candidates} canManage={isAdmin} />
    </div>
  );
}
