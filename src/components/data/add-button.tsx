import { useId } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Right-aligned primary action of a table toolbar; when `blockedReason` is set the button is disabled and the reason shown beside it. */
export function AddButton({ label, onClick, blockedReason }: { label: string; onClick: () => void; blockedReason?: string }) {
  const reasonId = useId();
  return (
    <div className="ml-auto flex items-center gap-3">
      {blockedReason && <span id={reasonId} className="text-caption text-muted-foreground">{blockedReason}</span>}
      <Button size="sm" disabled={!!blockedReason} aria-describedby={blockedReason ? reasonId : undefined} onClick={onClick}>
        <Plus aria-hidden className="size-4" />
        {label}
      </Button>
    </div>
  );
}
