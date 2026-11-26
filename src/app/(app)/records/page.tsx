import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { SectionError } from "@/features/dashboard/components/section";
import { settle } from "@/features/dashboard/settle";
import { ExportLinks } from "@/features/export/components/export-links";
import { LearningTable } from "@/features/learning/components/learning-table";
import { LearningTabs } from "@/features/learning/components/learning-tabs";
import { parseLearningTab } from "@/features/learning/tab";
import { toExamOptions } from "@/features/learning/exam-options";
import { listCourseOptions, listLearningItems } from "@/features/learning/queries";
import { listProviders } from "@/features/courses/queries";
import { isAiReaderEnabled } from "@/features/records/ai-flag";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { RecordsTable } from "@/features/records/components/records-table";
import { listCertificateOptions, listMemberOptions, listRecords } from "@/features/records/queries";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[]; approval?: string | string[]; team?: string | string[]; tab?: string | string[] }>;
}) {
  const { search, approval, team, tab } = await searchParams;
  const user = await getCurrentUser();
  // UX only — RLS would show a Member just their own rows here anyway; /me is their screen.
  if (user?.role === "member") redirect("/me");
  const [recordsResult, memberOptionsResult, certificateOptionsResult, itemsResult, coursesResult, providersResult, aiResult] = await Promise.all([
    settle(listRecords()),
    settle(listMemberOptions()),
    settle(listCertificateOptions()),
    settle(listLearningItems()),
    settle(listCourseOptions()),
    settle(listProviders()),
    settle(isAiReaderEnabled()),
  ]);

  const records = recordsResult.ok ? recordsResult.data : [];
  const memberOptions = memberOptionsResult.ok ? memberOptionsResult.data : [];
  const certificateOptions = certificateOptionsResult.ok ? certificateOptionsResult.data : [];
  const items = itemsResult.ok ? itemsResult.data : [];
  const courses = coursesResult.ok ? coursesResult.data : [];
  const providers = providersResult.ok ? providersResult.data : [];
  const aiReaderEnabled = aiResult.ok ? aiResult.data : false;
  // The Add flows need these pickers; an empty picker would look like "nothing to choose".
  const lookupsOk = memberOptionsResult.ok && certificateOptionsResult.ok && coursesResult.ok && providersResult.ok;

  // Dashboard links open the list already searched (?search=<name>) or filtered (?team=<name>); the key remounts the table when they change.
  const initialSearch = (Array.isArray(search) ? search[0] : search) ?? "";
  const initialTeam = (Array.isArray(team) ? team[0] : team) ?? "";
  const initialApproval = (Array.isArray(approval) ? approval[0] : approval) === "waiting";
  const canAddToCatalogue = user?.role === "admin";
  const reviewerMemberId = canAddToCatalogue ? null : (user?.memberId ?? null);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Team learning"
        description="Who holds which certificate, and who is working on which course or exam."
        actions={<ExportLinks />}
      />
      <RecordsRealtime />
      <LearningTabs
        initialTab={parseLearningTab(tab)}
        certificatesCount={recordsResult.ok ? records.length : undefined}
        learningCount={itemsResult.ok ? items.length : undefined}
        learning={
          itemsResult.ok && lookupsOk ? (
            <LearningTable
              key={`${initialSearch}|${initialTeam}`}
              initialSearch={initialSearch}
              initialTeam={initialTeam}
              rows={items}
              mode="team"
              memberOptions={memberOptions}
              courses={courses}
              examOptions={toExamOptions(certificateOptions)}
              viewerMemberId={user?.memberId ?? null}
              certificateOptions={certificateOptions}
              providers={providers}
              showCompanyFields
              canAddToCatalogue={canAddToCatalogue}
              canDelete
              aiReaderEnabled={aiReaderEnabled}
              records={records}
            />
          ) : (
            <SectionError title="Learning" />
          )
        }
        certificates={
          recordsResult.ok && lookupsOk ? (
            <RecordsTable
              key={`${initialSearch}|${initialTeam}|${initialApproval}`}
              initialSearch={initialSearch}
              initialTeam={initialTeam}
              initialApproval={initialApproval}
              canReview
              reviewerMemberId={reviewerMemberId}
              records={records}
              memberOptions={memberOptions}
              certificateOptions={certificateOptions}
              providers={providers}
              mode="team"
              canDelete
              showCompanyFields
              canAddToCatalogue={canAddToCatalogue}
              aiReaderEnabled={aiReaderEnabled}
            />
          ) : (
            <SectionError title="Certificates" />
          )
        }
      />
    </div>
  );
}
