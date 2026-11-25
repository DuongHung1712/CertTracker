import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
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
import { listCertificateOptions, listMemberOptions, listRecords, listStudyCourses } from "@/features/records/queries";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[]; approval?: string | string[]; team?: string | string[]; tab?: string | string[] }>;
}) {
  const { search, approval, team, tab } = await searchParams;
  const user = await getCurrentUser();
  // UX only — RLS would show a Member just their own rows here anyway; /me is their screen.
  if (user?.role === "member") redirect("/me");
  const [records, memberOptions, certificateOptions, studyCourses, items, courses, providers, aiReaderEnabled] = await Promise.all([
    listRecords(),
    listMemberOptions(),
    listCertificateOptions(),
    listStudyCourses(),
    listLearningItems(),
    listCourseOptions(),
    listProviders(),
    isAiReaderEnabled(),
  ]);

  // Dashboard links open the list already searched (?search=<name>) or filtered (?team=<name>); the key remounts the table when they change.
  const initialSearch = (Array.isArray(search) ? search[0] : search) ?? "";
  const initialTeam = (Array.isArray(team) ? team[0] : team) ?? "";
  const initialApproval = (Array.isArray(approval) ? approval[0] : approval) === "waiting";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team learning"
        description="Who holds which certificate, and who is working on which course or exam."
        actions={<ExportLinks />}
      />
      <RecordsRealtime />
      <LearningTabs
        initialTab={parseLearningTab(tab)}
        certificatesCount={records.length}
        learningCount={items.length}
        learning={
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
            studyCourses={studyCourses}
            providers={providers}
            showCompanyFields
            aiReaderEnabled={aiReaderEnabled}
            records={records}
          />
        }
        certificates={
          <RecordsTable
            key={`${initialSearch}|${initialTeam}|${initialApproval}`}
            initialSearch={initialSearch}
            initialTeam={initialTeam}
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
            aiReaderEnabled={aiReaderEnabled}
          />
        }
      />
    </div>
  );
}
