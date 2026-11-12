import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { RecordsTable } from "@/features/records/components/records-table";
import { listCertificateOptions, listRecords, listStudyCourses } from "@/features/records/queries";

const MY_LEARNING_DESCRIPTION = "Exam certificates you hold, courses you have studied and course completions.";

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.memberId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My learning" description={MY_LEARNING_DESCRIPTION} />
        <EmptyState
          title="Your account is not linked to a member"
          description="Ask your admin to link your account to a member so your learning shows here."
        />
      </div>
    );
  }

  const [records, certificateOptions, studyCourses] = await Promise.all([
    listRecords({ memberId: user.memberId }),
    listCertificateOptions(),
    listStudyCourses(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My learning"
        description={MY_LEARNING_DESCRIPTION}
        // The export is everything the caller's RLS shows; only for a Member is that exactly "my records".
        actions={user.role === "member" ? <ExportLinks /> : undefined}
      />
      <RecordsRealtime />
      <RecordsTable
        records={records}
        memberOptions={[]}
        certificateOptions={certificateOptions}
        studyCourses={studyCourses}
        mode="self"
        fixedMemberId={user.memberId}
        canDelete={user.role !== "member"}
        showCompanyFields={user.role !== "member"}
      />
    </div>
  );
}
