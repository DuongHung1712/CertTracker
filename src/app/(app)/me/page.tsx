import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { CareerCard } from "@/features/career/components/career-card";
import { getMemberCareer } from "@/features/career/queries";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { RecordsTable } from "@/features/records/components/records-table";
import { listCourseOptions, listRecords } from "@/features/records/queries";

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.memberId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My certificates" description="Certificates you hold and courses you are studying." />
        <EmptyState
          title="Your account is not linked to a member"
          description="Ask an admin to link your account to a member so your certificates show here."
        />
      </div>
    );
  }

  const [records, courseOptions, career] = await Promise.all([
    listRecords({ memberId: user.memberId }),
    listCourseOptions(),
    getMemberCareer(user.memberId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My certificates"
        description="Certificates you hold and courses you are studying."
        // The export is everything the caller's RLS shows; only for a Member is that exactly "my records".
        actions={user.role === "member" ? <ExportLinks /> : undefined}
      />
      <CareerCard roleName={career.careerRoleName} careerStart={career.careerStart} yoeYears={career.yoeYears} />
      <RecordsRealtime />
      <RecordsTable
        records={records}
        memberOptions={[]}
        courseOptions={courseOptions}
        mode="self"
        fixedMemberId={user.memberId}
        canDelete={user.role !== "member"}
        showCompanyFields={user.role !== "member"}
      />
    </div>
  );
}
