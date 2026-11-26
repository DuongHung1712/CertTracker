import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { SectionError } from "@/features/dashboard/components/section";
import { parseMemberView } from "@/features/dashboard/member-metrics";
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
import { listCertificateOptions, listRecords } from "@/features/records/queries";

const MY_LEARNING_DESCRIPTION = "Your certificates, and the courses and exams you are working on.";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; tab?: string | string[]; status?: string | string[]; approval?: string | string[] }>;
}) {
  const { view, tab, status, approval } = await searchParams;
  const initialView = parseMemberView(view);
  const initialStatus = (Array.isArray(status) ? status[0] : status) ?? "all";
  const initialApprovalState = Array.isArray(approval) ? approval[0] : approval;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.memberId) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title="My learning" description={MY_LEARNING_DESCRIPTION} />
        <EmptyState
          title="Your account is not linked to a member"
          description="Ask your admin to link your account to a member so your learning shows here."
        />
      </div>
    );
  }

  const [recordsResult, certificateOptionsResult, itemsResult, coursesResult, providersResult, aiResult] = await Promise.all([
    settle(listRecords({ memberId: user.memberId })),
    settle(listCertificateOptions()),
    settle(listLearningItems({ memberId: user.memberId })),
    settle(listCourseOptions()),
    settle(listProviders()),
    settle(isAiReaderEnabled()),
  ]);

  const records = recordsResult.ok ? recordsResult.data : [];
  const certificateOptions = certificateOptionsResult.ok ? certificateOptionsResult.data : [];
  const items = itemsResult.ok ? itemsResult.data : [];
  const courses = coursesResult.ok ? coursesResult.data : [];
  const providers = providersResult.ok ? providersResult.data : [];
  const aiReaderEnabled = aiResult.ok ? aiResult.data : false;
  // The Add flows need these pickers; an empty picker would look like "nothing to choose".
  const lookupsOk = certificateOptionsResult.ok && coursesResult.ok && providersResult.ok;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="My learning"
        description={MY_LEARNING_DESCRIPTION}
        // The export is everything the caller's RLS shows; only for a Member is that exactly "my records".
        actions={user.role === "member" ? <ExportLinks /> : undefined}
      />
      <RecordsRealtime />
      <LearningTabs
        initialTab={parseLearningTab(tab)}
        certificatesCount={recordsResult.ok ? records.length : undefined}
        learningCount={itemsResult.ok ? items.length : undefined}
        certificates={
          recordsResult.ok && lookupsOk ? (
            <RecordsTable
              // Dashboard tiles open ?view=<tile>; the table re-seeds when it changes (no key: refresh must not remount it).
              initialView={initialView}
              initialApprovalState={initialApprovalState}
              records={records}
              memberOptions={[]}
              certificateOptions={certificateOptions}
              providers={providers}
              mode="self"
              fixedMemberId={user.memberId}
              canDelete={user.role !== "member"}
              showCompanyFields={user.role !== "member"}
              canAddToCatalogue={user.role === "admin"}
              aiReaderEnabled={aiReaderEnabled}
            />
          ) : (
            <SectionError title="My certificates" />
          )
        }
        learning={
          itemsResult.ok && lookupsOk ? (
            <LearningTable
              initialStatus={initialStatus}
              rows={items}
              mode="self"
              fixedMemberId={user.memberId}
              courses={courses}
              examOptions={toExamOptions(certificateOptions)}
              viewerMemberId={user.memberId}
              certificateOptions={certificateOptions}
              providers={providers}
              showCompanyFields={user.role !== "member"}
              canAddToCatalogue={user.role === "admin"}
              canDelete={user.role !== "member"}
              aiReaderEnabled={aiReaderEnabled}
              records={records}
            />
          ) : (
            <SectionError title="My learning" />
          )
        }
      />
    </div>
  );
}
