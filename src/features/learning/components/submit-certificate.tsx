"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProposeCertificateDialog } from "@/features/certificates/components/propose-certificate-dialog";
import type { LearningRow } from "@/features/learning/queries";
import type { CertificateChoice } from "@/features/records/certificate-course";
import { RecordSheet } from "@/features/records/components/record-sheet";
import type { RecordRow } from "@/features/records/queries";

/** Which certificate a learning item can end in: its exam, its course's course certificate, both, or none yet. */
export function submitTargets(row: LearningRow, completionByCourse: Map<string, string>): { exam?: string; completion?: string } {
  const completion = row.courseId ? completionByCourse.get(row.courseId) : undefined;
  return {
    ...(row.targetCertificateId && { exam: row.targetCertificateId }),
    ...(completion && { completion }),
  };
}

/**
 * "Add certificate" on a learning item (decision #72): opens the certificate sheet prefilled. Saving the
 * certificate completes the item in the database (trigger training_records_close_learning), whatever path added
 * the certificate. A course without a course certificate yet proposes one when the user can propose.
 */
export function SubmitCertificate({
  row,
  onClose,
  certificateOptions,
  completionByCourse,
  providers,
  showCompanyFields = false,
  canAddToCatalogue = false,
  canDelete = false,
  viewerMemberId = null,
  mode,
  aiReaderEnabled = false,
  records,
}: {
  row: LearningRow;
  onClose: () => void;
  certificateOptions: CertificateChoice[];
  completionByCourse: Map<string, string>;
  providers?: { id: string; name: string }[];
  showCompanyFields?: boolean;
  canAddToCatalogue?: boolean;
  canDelete?: boolean;
  viewerMemberId?: string | null;
  mode?: "self" | "team";
  aiReaderEnabled?: boolean;
  records?: RecordRow[];
}) {
  const targets = submitTargets(row, completionByCourse);
  const both = targets.exam !== undefined && targets.completion !== undefined;
  const [chosen, setChosen] = useState<string | undefined>(both ? undefined : (targets.exam ?? targets.completion));
  const [proposed, setProposed] = useState<CertificateChoice | null>(null);
  const needsProposal = targets.exam === undefined && targets.completion === undefined;
  const isSelf = mode === "self" || (Boolean(viewerMemberId) && row.memberId === viewerMemberId);
  const canPropose = !canAddToCatalogue && Boolean(viewerMemberId);

  const certificateId = chosen ?? proposed?.id;
  return (
    <>
      {both && chosen === undefined && (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Which certificate?</DialogTitle>
              <DialogDescription>
                {isSelf
                  ? "This item has a course and an exam. Add the one you received."
                  : "This item has a course and an exam. Add the one the member received."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={() => setChosen(targets.exam)}>
                {row.targetCertificateName ? `Exam certificate: ${row.targetCertificateName}` : "Exam certificate"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setChosen(targets.completion)}>
                {row.courseName ? `Course certificate: ${row.courseName}` : "Course certificate"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {needsProposal && proposed === null && (
        canPropose ? (
          <ProposeCertificateDialog
            open
            onOpenChange={(open) => !open && onClose()}
            defaultKind="completion"
            defaultName={row.courseName ?? ""}
            providers={providers}
            onSuccess={setProposed}
          />
        ) : (
          <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Course certificate missing</DialogTitle>
                <DialogDescription>
                  {canAddToCatalogue
                    ? "This course does not grant a course certificate yet. Add one in the Catalogue first."
                    : "This course does not grant a course certificate yet. Ask an admin to add it to the Catalogue."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                {canAddToCatalogue && (
                  <Button nativeButton={false} render={<Link href="/courses" />} onClick={onClose}>
                    Open Catalogue
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      )}
      <RecordSheet
        open={certificateId !== undefined}
        onOpenChange={(open) => !open && onClose()}
        editing={null}
        memberOptions={[]}
        certificateOptions={proposed ? [...certificateOptions, proposed] : certificateOptions}
        showCompanyFields={showCompanyFields}
        canAddToCatalogue={canAddToCatalogue}
        canDelete={canDelete}
        viewerMemberId={viewerMemberId ?? (mode === "self" ? row.memberId : null)}
        aiReaderEnabled={aiReaderEnabled}
        records={records}
        fixedMemberId={row.memberId}
        presetCertificateId={certificateId}
        providers={providers}
      />
    </>
  );
}
