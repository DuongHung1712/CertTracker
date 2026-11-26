"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { UserGuideCard, type UserGuideProps } from "@/features/guide/components/user-guide-card";
import { PageHeader } from "@/components/app-shell/page-header";
import type { ComboboxOption } from "@/components/entity-combobox";
import { Button } from "@/components/ui/button";
import { ComplianceCopilotWidget } from "@/features/dashboard/components/member/compliance-copilot-widget";
import { MemberAttentionBanner } from "@/features/dashboard/components/member/member-attention-banner";
import { MemberCertificatesList } from "@/features/dashboard/components/member/member-certificates-list";
import { MemberKpiCards } from "@/features/dashboard/components/member/member-kpi-cards";
import { MemberLearningNow } from "@/features/dashboard/components/member/member-learning-now";
import { MemberProfileCard } from "@/features/dashboard/components/member/member-profile-card";
import { SkillsMatrixCard } from "@/features/dashboard/components/member/skills-matrix-card";
import { Section, SectionError } from "@/features/dashboard/components/section";
import { calculateMemberKpis, getAttentionRecord } from "@/features/dashboard/member-metrics";
import { ExportLinks } from "@/features/export/components/export-links";
import { LearningSheet } from "@/features/learning/components/learning-sheet";
import type { CourseOption, LearningRow } from "@/features/learning/queries";
import type { CertificateChoice } from "@/features/records/certificate-course";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import type { RecordRow } from "@/features/records/queries";
import type { MemberSkillSummary } from "@/features/skills/types";

export function MemberDashboardView({
  fullName,
  teamName,
  careerRoleName,
  yoeYears,
  memberId,
  records,
  journey,
  learningItems = [],
  recordsError,
  learningError,
  skillSummary,
  skillsError,
  certificateOptions,
  providers = [],
  aiReaderEnabled = false,
  courses,
  examOptions,
  subtitle,
  guide,
}: {
  /** The sign-in guide: shown under the header, never above it. */
  guide?: UserGuideProps;
  fullName: string;
  teamName: string | null;
  careerRoleName: string | null;
  yoeYears: number | null;
  memberId: string;
  /** Certificates (results). */
  records: RecordRow[];
  /** Open learning items as journey rows (features/learning/journey.ts): counted, never listed as certificates. */
  journey: RecordRow[];
  /** Raw learning items passed to LearningSheet for duplicate prevention. */
  learningItems?: LearningRow[];
  recordsError?: string;
  learningError?: string;
  skillSummary?: MemberSkillSummary;
  skillsError?: string;
  certificateOptions: CertificateChoice[];
  providers?: { id: string; name: string }[];
  aiReaderEnabled?: boolean;
  courses: CourseOption[];
  examOptions: ComboboxOption[];
  /** Greeting and "figures as of" time, worked out on the server so the first render matches on the client. */
  subtitle: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordRow | null>(null);
  // The learning sheet: opened to renew an exam (preset) or to add learning (no preset); null = closed (decision #72).
  const [learningSheet, setLearningSheet] = useState<{ examId: string | null } | null>(null);

  const memberKpis = calculateMemberKpis([...records, ...journey]);
  const attention = getAttentionRecord([...records, ...journey]);

  function handleAddCertificate() {
    setEditingRecord(null);
    setSheetOpen(true);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-20">
      <PageHeader
        title="Dashboard"
        description={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportLinks />
            {/* The sheet lives in MemberCertificatesList, which is not rendered when the records failed to load. */}
            {!recordsError && (
              <Button onClick={handleAddCertificate} className="gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                <span>Add certificate</span>
              </Button>
            )}
          </div>
        }
      />

      {guide && <UserGuideCard {...guide} />}

      <RecordsRealtime />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-4 xl:col-span-4">
          <MemberProfileCard fullName={fullName} teamName={teamName} careerRoleName={careerRoleName} yoeYears={yoeYears} />
          {skillsError ? <SectionError title="My skills" /> : <SkillsMatrixCard summary={skillSummary} />}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-8 xl:col-span-8">
          <Section title="Overview">
            {recordsError ? <SectionError title="Overview" /> : <MemberKpiCards kpis={memberKpis} learningError={learningError} />}
          </Section>

          <MemberAttentionBanner attention={attention} onRenew={(record) => setLearningSheet({ examId: record.certificateId })} />

          {learningError ? (
            <SectionError title="Learning now" />
          ) : (
            <MemberLearningNow items={journey} onAdd={() => setLearningSheet({ examId: null })} />
          )}

          {recordsError ? (
            <SectionError title="My certificates" />
          ) : (
            <MemberCertificatesList
              fullName={fullName}
              records={records}
              certificateOptions={certificateOptions}
              providers={providers}
              aiReaderEnabled={aiReaderEnabled}
              memberId={memberId}
              sheetOpen={sheetOpen}
              onSheetOpenChange={setSheetOpen}
              editingRecord={editingRecord}
              onEditRecord={setEditingRecord}
            />
          )}
        </div>
      </div>

      <LearningSheet
        key={learningSheet?.examId ?? "none"}
        open={learningSheet !== null}
        onOpenChange={(open) => !open && setLearningSheet(null)}
        editing={null}
        fixedMemberId={memberId}
        viewerMemberId={memberId}
        courses={courses}
        examOptions={examOptions}
        rows={learningItems}
        providers={providers}
        presetTargetCertificateId={learningSheet?.examId ?? undefined}
      />

      <ComplianceCopilotWidget />
    </div>
  );
}
