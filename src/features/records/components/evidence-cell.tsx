import { FileCheck, Link2, TriangleAlert } from "lucide-react";
import type { RecordRow } from "@/features/records/queries";

const LINK_CLASS = "relative inline-flex text-foreground hover:text-primary after:absolute after:-inset-[6px]";

/** Whether proof was submitted: a file (opens it), only a link (opens it), nothing on a completed row (a gap), or n/a. */
export function EvidenceCell({ record }: { record: Pick<RecordRow, "id" | "hasEvidence" | "certificateUrl" | "status"> }) {
  if (record.hasEvidence) {
    return (
      <a href={`/api/records/${record.id}/evidence`} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        <FileCheck aria-hidden className="size-4" />
        <span className="sr-only">Proof file attached</span>
      </a>
    );
  }
  if (record.certificateUrl) {
    return (
      <a href={record.certificateUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        <Link2 aria-hidden className="size-4" />
        <span className="sr-only">Link only</span>
      </a>
    );
  }
  if (record.status === "done") {
    return (
      <span className="inline-flex text-muted-foreground">
        <TriangleAlert aria-hidden className="size-4" />
        <span className="sr-only">No proof yet</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">None</span>
    </span>
  );
}
