"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProposeCertificateDialog } from "@/features/certificates/components/propose-certificate-dialog";
import type { LearningRow } from "@/features/learning/queries";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import { RecordSheet } from "@/features/records/components/record-sheet";

/** Which certificate a learning item can end in: its exam, its course's completion certificate, both, or none yet. */
export function submitTargets(row: LearningRow, completionByCourse: Map<string, string>): { exam?: string; completion?: string } {
  const completion = row.courseId ? completionByCourse.get(row.courseId) : undefined;
  return {
    ...(row.targetCertificateId && { exam: row.targetCertificateId }),
    ...(completion && { completion }),
  };
}

/**
 * "Submit certificate" on a learning item (decision #72): opens the certificate sheet prefilled. Saving the
 * certificate completes the item in the database (trigger training_records_close_learning), whatever path added
 * the certificate. A course without a completion certificate yet proposes one.
 */
export function SubmitCertificate({
  row,
  onClose,
  certificateOptions,
  studyCourses,
  completionByCourse,
  providers,
}: {
  row: LearningRow;
  onClose: () => void;
  certificateOptions: CertificateChoice[];
  studyCourses: StudyCourse[];
  completionByCourse: Map<string, string>;
  providers?: { id: string; name: string }[];
}) {
  const targets = submitTargets(row, completionByCourse);
  const both = targets.exam !== undefined && targets.completion !== undefined;
  const [chosen, setChosen] = useState<string | undefined>(both ? undefined : (targets.exam ?? targets.completion));
  const [proposed, setProposed] = useState<CertificateChoice | null>(null);
  const needsProposal = targets.exam === undefined && targets.completion === undefined;

  const certificateId = chosen ?? proposed?.id;
  return (
    <>
      {both && chosen === undefined && (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Which certificate?</DialogTitle>
              <DialogDescription>This item has a course and an exam. Submit the one you received.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={() => setChosen(targets.exam)}>
                Exam certificate
              </Button>
              <Button type="button" variant="outline" onClick={() => setChosen(targets.completion)}>
                Course certificate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {needsProposal && proposed === null && (
        <ProposeCertificateDialog
          open
          onOpenChange={(open) => !open && onClose()}
          defaultKind="completion"
          defaultName={row.courseName ?? ""}
          providers={providers}
          onSuccess={setProposed}
        />
      )}
      <RecordSheet
        open={certificateId !== undefined}
        onOpenChange={(open) => !open && onClose()}
        editing={null}
        memberOptions={[]}
        certificateOptions={proposed ? [...certificateOptions, proposed] : certificateOptions}
        studyCourses={studyCourses}
        showCompanyFields={false}
        fixedMemberId={row.memberId}
        presetCertificateId={certificateId}
        providers={providers}
      />
    </>
  );
}
