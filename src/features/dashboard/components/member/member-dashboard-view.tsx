"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import type { ComboboxOption } from "@/components/entity-combobox";
import { Button } from "@/components/ui/button";
import { DepartmentSummaryCard } from "@/features/dashboard/components/member/department-summary-card";
import { MemberAttentionBanner } from "@/features/dashboard/components/member/member-attention-banner";
import { MemberCertificatesList } from "@/features/dashboard/components/member/member-certificates-list";
import { MemberComingSoonStack } from "@/features/dashboard/components/member/member-coming-soon-stack";
import { MemberKpiCards } from "@/features/dashboard/components/member/member-kpi-cards";
import { MemberProfileCard } from "@/features/dashboard/components/member/member-profile-card";
import { Section, SectionError } from "@/features/dashboard/components/section";
import {
  calculateMemberKpis,
  getAttentionRecord,
  getGreeting,
} from "@/features/dashboard/member-metrics";
import type { DashboardKpis } from "@/features/dashboard/schema";
import { ExportLinks } from "@/features/export/components/export-links";
import { RecordsRealtime } from "@/features/records/components/records-realtime";
import type { RecordRow } from "@/features/records/queries";
import { formatDateTimeVn } from "@/lib/format";

export function MemberDashboardView({
  fullName,
  teamName,
  careerRoleName,
  yoeYears,
  memberId,
  records,
  recordsError,
  courseOptions,
  departmentKpis,
  departmentKpisError,
}: {
  fullName: string;
  teamName: string | null;
  careerRoleName: string | null;
  yoeYears: number | null;
  memberId: string;
  records: RecordRow[];
  recordsError?: string;
  courseOptions: ComboboxOption[];
  departmentKpis: DashboardKpis | null;
  departmentKpisError?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordRow | null>(null);

  const greeting = getGreeting(fullName);
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
        description={`${greeting} · Figures as of ${formatDateTimeVn(new Date().toISOString())}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportLinks />
            <Button size="sm" onClick={handleAddCertificate} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add certificate</span>
            </Button>
          </div>
        }
      />

      <RecordsRealtime />

      {/* 1. Attention banner for urgent/expired records */}
      <MemberAttentionBanner attention={attention} onUploadProof={handleUploadProof} />

      {/* 2. Overview: Member personal KPIs */}
      <Section title="Overview">
        {recordsError ? (
          <SectionError title="Overview" />
        ) : (
          <MemberKpiCards kpis={memberKpis} />
        )}
      </Section>

      {/* 3. Main 2-column layout: Left (Profile + Certificates list), Right (Department totals + Coming Soon) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <MemberProfileCard
            fullName={fullName}
            teamName={teamName}
            careerRoleName={careerRoleName}
            yoeYears={yoeYears}
          />

          {recordsError ? (
            <SectionError title="My certificates" />
          ) : (
            <MemberCertificatesList
              records={records}
              courseOptions={courseOptions}
              memberId={memberId}
              sheetOpen={sheetOpen}
              onSheetOpenChange={setSheetOpen}
              editingRecord={editingRecord}
              onEditRecord={setEditingRecord}
            />
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          {departmentKpisError || !departmentKpis ? (
            <SectionError title="Across the department" />
          ) : (
            <DepartmentSummaryCard kpis={departmentKpis} />
          )}

          <MemberComingSoonStack />
        </div>
      </div>
    </div>
  );
}
