import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
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
        <PageHeader title="Chứng chỉ của tôi" description="Chứng chỉ bạn đã có và đang học." />
        <EmptyState
          title="Tài khoản chưa liên kết với thành viên nào"
          description="Liên hệ quản trị viên để được gắn vào danh sách thành viên."
        />
      </div>
    );
  }

  const [records, courseOptions] = await Promise.all([
    listRecords({ memberId: user.memberId }),
    listCourseOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Chứng chỉ của tôi"
        description="Chứng chỉ bạn đã có và đang học."
        // The export is everything the caller's RLS shows; only for a Member is that exactly "my records".
        actions={user.role === "member" ? <ExportLinks /> : undefined}
      />
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
