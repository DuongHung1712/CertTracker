import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { SectionError } from "@/features/dashboard/components/section";
import { settle } from "@/features/dashboard/settle";
import { DcSection } from "@/features/organizations/components/dc-section";
import { ProgramSection } from "@/features/organizations/components/program-section";
import { TeamSection } from "@/features/organizations/components/team-section";
import { listDcs, listManagerCandidates, listPrograms, listScopeManagerIds, listTeams } from "@/features/organizations/queries";

export default async function OrgPage() {
  const user = await getCurrentUser();
  // UX only: RLS already limits writes to admins; the menu shows this page to admins only.
  if (user?.role !== "admin") redirect("/dashboard");
  const [dcs, programRows, teamRows, candidates] = await Promise.all([
    settle(listDcs()),
    settle(listPrograms()),
    settle(listTeams()),
    settle(listManagerCandidates()),
  ]);
  const [programs, teams] = await Promise.all([
    programRows.ok
      ? settle(
          Promise.all(
            programRows.data.map(async (program) => ({
              ...program,
              managerIds: await listScopeManagerIds({ kind: "program", id: program.id }),
            })),
          ),
        )
      : Promise.resolve(programRows),
    teamRows.ok
      ? settle(
          Promise.all(
            teamRows.data.map(async (team) => ({
              ...team,
              managerIds: await listScopeManagerIds({ kind: "team", id: team.id }),
            })),
          ),
        )
      : Promise.resolve(teamRows),
  ]);
  // A section that needs a failed dependency shows an error, never an empty list that reads as "no data".
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Organisation" description="Centres, programs and teams." />
      {dcs.ok ? <DcSection dcs={dcs.data} canManage /> : <SectionError title="Centres" />}
      {programs.ok && dcs.ok && candidates.ok ? (
        <ProgramSection programs={programs.data} dcs={dcs.data} candidates={candidates.data} canManage />
      ) : (
        <SectionError title="Programs" />
      )}
      {teams.ok && programs.ok && candidates.ok ? (
        <TeamSection teams={teams.data} programs={programs.data} candidates={candidates.data} canManage />
      ) : (
        <SectionError title="Teams" />
      )}
    </div>
  );
}
