"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setScopeManagers } from "@/features/organizations/actions";
import { ScopeManagersField } from "@/features/organizations/components/scope-managers-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Candidate = { userId: string; fullName: string; email: string };
type ProgramWithManagers = { id: string; name: string; managerIds: string[] };

/** Sets who manages a whole program: they see the members of every team in it, including teams added later. */
export function ProgramManagersDialog({
  program,
  candidates,
  onClose,
}: {
  program: ProgramWithManagers | null;
  candidates: Candidate[];
  onClose: () => void;
}) {
  const [managerIds, setManagerIds] = useState<string[]>(program?.managerIds ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reset the selection when the dialog opens for a different program — adjusted during render,
  // per React's guidance, instead of in an effect (see TeamDialog).
  const [resetKey, setResetKey] = useState(program?.id ?? null);
  if (resetKey !== (program?.id ?? null)) {
    setResetKey(program?.id ?? null);
    setManagerIds(program?.managerIds ?? []);
    setError(null);
  }

  async function handleSave() {
    if (!program) return;
    setPending(true);
    const result = await setScopeManagers({ scope: { kind: "program", id: program.id }, userIds: managerIds });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`Managers saved for ${program.name}`);
    onClose();
  }

  return (
    <Dialog open={!!program} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">Set managers for {program?.name}</DialogTitle>
          <DialogDescription>
            Program managers see the members of every team in this program, including teams added later.
          </DialogDescription>
        </DialogHeader>
        <ScopeManagersField candidates={candidates} selected={managerIds} onChange={setManagerIds} />
        {error && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={handleSave}>
            {pending ? "Saving…" : "Save managers"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
