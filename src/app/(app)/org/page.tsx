import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { DcSection } from "@/features/organizations/components/dc-section";
import { ProgramSection } from "@/features/organizations/components/program-section";
import { TeamSection } from "@/features/organizations/components/team-section";
import { listDcs, listManagerCandidates, listPrograms, listScopeManagerIds, listTeams } from "@/features/organizations/queries";

export default async function OrgPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";
  const [dcs, programRows, teamRows, candidates] = await Promise.all([
    listDcs(),
    listPrograms(),
    listTeams(),
    listManagerCandidates(),
  ]);
  const [programs, teams] = await Promise.all([
    Promise.all(
      programRows.map(async (program) => ({
        ...program,
        managerIds: await listScopeManagerIds({ kind: "program", id: program.id }),
      })),
    ),
    Promise.all(
      teamRows.map(async (team) => ({
        ...team,
        managerIds: await listScopeManagerIds({ kind: "team", id: team.id }),
      })),
    ),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Organisation" description="Centres, programs and teams." />
      <DcSection dcs={dcs} canManage={isAdmin} />
      <ProgramSection programs={programs} dcs={dcs} candidates={candidates} canManage={isAdmin} />
      <TeamSection teams={teams} programs={programs} candidates={candidates} canManage={isAdmin} />
    </div>
  );
}
