import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { RecordsTable } from "@/features/records/components/records-table";
import { listCertificateOptions, listMemberOptions, listRecords, listStudyCourses } from "@/features/records/queries";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[]; approval?: string | string[] }>;
}) {
  const { search, approval } = await searchParams;
  const user = await getCurrentUser();
  // UX only — RLS would show a Member just their own rows here anyway; /me is their screen.
  if (user?.role === "member") redirect("/me");
  const [records, memberOptions, certificateOptions, studyCourses] = await Promise.all([
    listRecords(),
    listMemberOptions(),
    listCertificateOptions(),
    listStudyCourses(),
  ]);

  // Dashboard links open the list already searched (?search=<name>); the key remounts the table when it changes.
  const initialSearch = (Array.isArray(search) ? search[0] : search) ?? "";

  const initialApproval = (Array.isArray(approval) ? approval[0] : approval) === "waiting";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Learning"
        description="Who holds or is studying which exam certificate, and who has completed which course."
        actions={<ExportLinks />}
      />
      <RecordsRealtime />
      <RecordsTable
        key={`${initialSearch}|${initialApproval}`}
        initialSearch={initialSearch}
        initialApproval={initialApproval}
        canReview
        reviewerMemberId={user?.role === "admin" ? null : (user?.memberId ?? null)}
        records={records}
        memberOptions={memberOptions}
        certificateOptions={certificateOptions}
        studyCourses={studyCourses}
        mode="team"
        canDelete
        showCompanyFields
        canAddToCatalogue={user?.role === "admin"}
      />
    </div>
  );
}
