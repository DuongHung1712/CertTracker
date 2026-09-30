import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { RecordsTable } from "@/features/records/components/records-table";
import { listCourseOptions, listMemberOptions, listRecords } from "@/features/records/queries";

export default async function RecordsPage() {
  const user = await getCurrentUser();
  // UX only — RLS would show a Member just their own rows here anyway; /me is their screen.
  if (user?.role === "member") redirect("/me");
  const [records, memberOptions, courseOptions] = await Promise.all([
    listRecords(),
    listMemberOptions(),
    listCourseOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Chứng chỉ theo người" description="Ai đang có, đang học chứng chỉ nào." />
      <RecordsRealtime />
      <RecordsTable
        records={records}
        memberOptions={memberOptions}
        courseOptions={courseOptions}
        mode="team"
        canDelete
        showCompanyFields
      />
    </div>
  );
}
