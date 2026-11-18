"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import { Button } from "@/components/ui/button";
import { ComplianceCopilotWidget } from "@/features/dashboard/components/member/compliance-copilot-widget";
import { MemberAttentionBanner } from "@/features/dashboard/components/member/member-attention-banner";
import { MemberCertificatesList } from "@/features/dashboard/components/member/member-certificates-list";
import { MemberKpiCards } from "@/features/dashboard/components/member/member-kpi-cards";
import { MemberProfileCard } from "@/features/dashboard/components/member/member-profile-card";
import { Section, SectionError } from "@/features/dashboard/components/section";
import {
  calculateMemberKpis,
  getAttentionRecord,
} from "@/features/dashboard/member-metrics";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import type { RecordRow } from "@/features/records/queries";
import type { RecordStatus } from "@/components/status/labels";

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
  // Set by "Mark completed" only; every other way of opening the sheet clears it.
  const [presetStatus, setPresetStatus] = useState<RecordStatus | undefined>(undefined);
  const [presetCertificateId, setPresetCertificateId] = useState<string | undefined>(undefined);

  const memberKpis = calculateMemberKpis(records);
  const attention = getAttentionRecord(records);

  function handleRenewCredential(record: RecordRow) {
    setEditingRecord(null);
    setPresetCertificateId(record.certificateId);
    setPresetStatus("in_progress");
    setSheetOpen(true);
  }

  function handleAddCertificate() {
    setEditingRecord(null);
    setPresetCertificateId(undefined);
    setPresetStatus(undefined);
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
            <Button size="sm" onClick={handleAddCertificate} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add certificate or course completion</span>
            </Button>
          </div>
        }
      />

      <RecordsRealtime />

      {/* Decluttered 2-Column Workspace Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Profile with integrated Focus Area & Career Growth */}
        <div className="flex flex-col gap-6 lg:col-span-4 xl:col-span-4">
          <MemberProfileCard
            fullName={fullName}
            teamName={teamName}
            careerRoleName={careerRoleName}
            yoeYears={yoeYears}
          />
        </div>

        {/* Right Column: Hero KPIs (Overview), Attention Banner, Registered Records */}
        <div className="flex flex-col gap-6 lg:col-span-8 xl:col-span-8">
          <Section title="Overview">
            {recordsError ? (
              <SectionError title="Overview" />
            ) : (
              <MemberKpiCards kpis={memberKpis} />
            )}
          </Section>

          <MemberAttentionBanner attention={attention} onRenew={handleRenewCredential} />

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
              onSheetOpenChange={(open) => {
                setSheetOpen(open);
                if (!open) {
                  setPresetCertificateId(undefined);
                  setPresetStatus(undefined);
                }
              }}
              editingRecord={editingRecord}
              presetStatus={presetStatus}
              presetCertificateId={presetCertificateId}
              onEditRecord={(record, preset) => {
                setEditingRecord(record);
                setPresetCertificateId(undefined);
                setPresetStatus(preset);
              }}
            />
          )}
        </div>
      </div>

      {/* Floating Copilot Chatbot Widget in Bottom-Right */}
      <ComplianceCopilotWidget />
    </div>
  );
}
