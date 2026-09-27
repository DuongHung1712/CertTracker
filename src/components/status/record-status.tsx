import { CircleCheck, CircleDashed, LoaderCircle, type LucideIcon } from "lucide-react";
import { RECORD_STATUS_LABEL, type RecordStatus } from "@/components/status/labels";

const ICON: Record<RecordStatus, LucideIcon> = {
  done: CircleCheck,
  in_progress: LoaderCircle,
  not_started: CircleDashed,
};

export function RecordStatusLabel({ status }: { status: RecordStatus }) {
  const Icon = ICON[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-table text-foreground">
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      {RECORD_STATUS_LABEL[status]}
    </span>
  );
}
