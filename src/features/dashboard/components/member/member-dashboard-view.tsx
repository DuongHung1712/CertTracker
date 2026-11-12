"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import { Button } from "@/components/ui/button";
import { AuditVerificationCard } from "@/features/dashboard/components/member/audit-verification-card";
import { ComplianceCopilotCard } from "@/features/dashboard/components/member/compliance-copilot-card";
import { MemberAttentionBanner } from "@/features/dashboard/components/member/member-attention-banner";
import { MemberCertificatesList } from "@/features/dashboard/components/member/member-certificates-list";
import { MemberKpiCards } from "@/features/dashboard/components/member/member-kpi-cards";
import { MemberProfileCard } from "@/features/dashboard/components/member/member-profile-card";
import { QuarterlyTargetCard } from "@/features/dashboard/components/member/quarterly-target-card";
import { SkillsMatrixCard } from "@/features/dashboard/components/member/skills-matrix-card";
import { TargetRoleCard } from "@/features/dashboard/components/member/target-role-card";
import { Section, SectionError } from "@/features/dashboard/components/section";
import {
  calculateMemberKpis,
  getAttentionRecord,
} from "@/features/dashboard/member-metrics";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import type { RecordRow } from "@/features/records/queries";

export function MemberDashboardView({
  fullName,
  teamName,
  careerRoleName,
  yoeYears,
  memberId,
  records,
  recordsError,
  certificateOptions,
  studyCourses,
  subtitle,
}: {
  fullName: string;
  teamName: string | null;
  careerRoleName: string | null;
  yoeYears: number | null;
  memberId: string;
  records: RecordRow[];
  recordsError?: string;
  certificateOptions: CertificateChoice[];
  studyCourses: StudyCourse[];
  /** Greeting and "figures as of" time, worked out on the server so the first render matches on the client. */
  subtitle: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordRow | null>(null);

  const memberKpis = calculateMemberKpis(records);
  const attention = getAttentionRecord(records);

  function handleUploadProof(record: RecordRow) {
    setEditingRecord(record);
    setSheetOpen(true);
  }

  function handleAddCertificate() {
    setEditingRecord(null);
    setSheetOpen(true);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportLinks />
            <Button size="sm" onClick={handleAddCertificate} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add certificate or course completion</span>
            </Button>
          </div>
        }
      />

      <RecordsRealtime />

      {/* Main 3-Zone Workspace Layout (Figma node-id 1:2) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 xl:grid-cols-12">
        {/* Left Column: Profile, Skills Matrix, Quarterly Objective */}
        <div className="flex flex-col gap-6 lg:col-span-4 xl:col-span-3">
          <MemberProfileCard
            fullName={fullName}
            teamName={teamName}
            careerRoleName={careerRoleName}
            yoeYears={yoeYears}
          />

          <SkillsMatrixCard />

          <QuarterlyTargetCard />
        </div>

        {/* Centre Column: Hero KPIs (Overview), Attention Banner, Registered Records */}
        <div className="flex flex-col gap-6 lg:col-span-8 xl:col-span-6">
          <Section title="Overview">
            {recordsError ? (
              <SectionError title="Overview" />
            ) : (
              <MemberKpiCards kpis={memberKpis} />
            )}
          </Section>

          <MemberAttentionBanner attention={attention} onUploadProof={handleUploadProof} />

          {recordsError ? (
            <SectionError title="My learning" />
          ) : (
            <MemberCertificatesList
              fullName={fullName}
              records={records}
              certificateOptions={certificateOptions}
              studyCourses={studyCourses}
              memberId={memberId}
              sheetOpen={sheetOpen}
              onSheetOpenChange={setSheetOpen}
              editingRecord={editingRecord}
              onEditRecord={setEditingRecord}
            />
          )}
        </div>

        {/* Right Column: Audit Verification, Copilot, Target Role */}
        <div className="flex flex-col gap-6 lg:col-span-12 xl:col-span-3">
          <AuditVerificationCard />

          <ComplianceCopilotCard />

          <TargetRoleCard />
        </div>
      </div>
    </div>
  );
}
