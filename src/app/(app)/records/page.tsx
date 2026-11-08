import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { RecordsTable } from "@/features/records/components/records-table";
import { listCourseOptions, listMemberOptions, listRecords } from "@/features/records/queries";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const { search } = await searchParams;
  const user = await getCurrentUser();
  // UX only — RLS would show a Member just their own rows here anyway; /me is their screen.
  if (user?.role === "member") redirect("/me");
  const [records, memberOptions, courseOptions] = await Promise.all([
    listRecords(),
    listMemberOptions(),
    listCourseOptions(),
  ]);

  // Dashboard links open the list already searched (?search=<name>); the key remounts the table when it changes.
  const initialSearch = (Array.isArray(search) ? search[0] : search) ?? "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Certificates"
        description="Who holds, or is studying, which certificate."
        actions={<ExportLinks />}
      />
      <RecordsRealtime />
      <RecordsTable
        key={initialSearch}
        initialSearch={initialSearch}
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
