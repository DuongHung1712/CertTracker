import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { getCurrentUser } from "@/features/auth/queries";
import { parseMemberView } from "@/features/dashboard/member-metrics";
import { ExportLinks } from "@/features/export/components/export-links";
import { LearningTable } from "@/features/learning/components/learning-table";
import { LearningTabs } from "@/features/learning/components/learning-tabs";
import { parseLearningTab } from "@/features/learning/tab";
import { toExamOptions } from "@/features/learning/exam-options";
import { listCourseOptions, listLearningItems } from "@/features/learning/queries";
import { isAiReaderEnabled } from "@/features/records/ai-flag";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import { RecordsTable } from "@/features/records/components/records-table";
import { listCertificateOptions, listRecords, listStudyCourses } from "@/features/records/queries";

const MY_LEARNING_DESCRIPTION = "Your certificates, and the courses and exams you are working on.";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; tab?: string | string[]; status?: string | string[] }>;
}) {
  const { view, tab, status } = await searchParams;
  const initialView = parseMemberView(view);
  const initialStatus = (Array.isArray(status) ? status[0] : status) ?? "all";
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

  const [records, certificateOptions, studyCourses, items, courses, aiReaderEnabled] = await Promise.all([
    listRecords({ memberId: user.memberId }),
    listCertificateOptions(),
    listStudyCourses(),
    listLearningItems({ memberId: user.memberId }),
    listCourseOptions(),
    isAiReaderEnabled(),
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
      <LearningTabs
        initialTab={parseLearningTab(tab)}
        certificatesCount={records.length}
        learningCount={items.length}
        certificates={
          <RecordsTable
            // The dashboard tiles open this page with ?view=<tile>; the key remounts the table when it changes.
            key={initialView ?? "all"}
            initialView={initialView}
            records={records}
            memberOptions={[]}
            certificateOptions={certificateOptions}
            studyCourses={studyCourses}
            mode="self"
            fixedMemberId={user.memberId}
            canDelete={user.role !== "member"}
            showCompanyFields={user.role !== "member"}
            aiReaderEnabled={aiReaderEnabled}
          />
        }
        learning={
          <LearningTable key={initialStatus} initialStatus={initialStatus} rows={items} mode="self" fixedMemberId={user.memberId} courses={courses} examOptions={toExamOptions(certificateOptions)} viewerMemberId={user.memberId} certificateOptions={certificateOptions} studyCourses={studyCourses} />
        }
      />
    </div>
  );
}
