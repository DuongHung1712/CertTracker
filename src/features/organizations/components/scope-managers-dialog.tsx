"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { setScopeManagers } from "@/features/organizations/actions";
import { ScopeManagersField, type ManagerCandidate } from "@/features/organizations/components/scope-managers-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ManagedScope = {
  kind: "program" | "team";
  id: string;
  name: string;
  managerIds: string[];
  /** For teams: parent program name and its manager userIds, so admins see inherited access. */
  programName?: string;
  inheritedManagerIds?: string[];
};

/** Unified dialog for assigning managers to either a program or a team. */
export function ScopeManagersDialog({
  scope,
  candidates,
  onClose,
}: {
  scope: ManagedScope | null;
  candidates: ManagerCandidate[];
  onClose: () => void;
}) {
  const [managerIds, setManagerIds] = useState<string[]>(scope?.managerIds ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset the selection when the dialog opens for a different scope (or reopens after saving).
  const currentKey = scope ? `${scope.kind}:${scope.id}:${scope.managerIds.join(",")}` : null;
  const [resetKey, setResetKey] = useState(currentKey);
  if (resetKey !== currentKey) {
    setResetKey(currentKey);
    setManagerIds(scope?.managerIds ?? []);
    setError(null);
    setConfirmDiscard(false);
  }

  const initialIds = scope?.managerIds ?? [];
  const isDirty =
    managerIds.length !== initialIds.length ||
    (() => {
      const initial = new Set(initialIds);
      return managerIds.some((id) => !initial.has(id));
    })();

  function closeClean() {
    setManagerIds(initialIds);
    setError(null);
    setConfirmDiscard(false);
    onClose();
  }

  function handleCloseRequest() {
    if (pending) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    closeClean();
  }

  const inheritedNames =
    scope?.kind === "team" && scope.inheritedManagerIds?.length
      ? candidates.filter((c) => scope.inheritedManagerIds!.includes(c.userId)).map((c) => c.fullName)
      : [];

  async function handleSave() {
    if (!scope) return;
    setPending(true);
    const result = await setScopeManagers({ scope: { kind: scope.kind, id: scope.id }, userIds: managerIds });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`Saved managers for ${scope.name}`);
    setConfirmDiscard(false);
    onClose();
  }

  return (
    <>
      <Dialog open={!!scope} onOpenChange={(open) => !open && handleCloseRequest()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-section-title">Set managers for {scope?.name}</DialogTitle>
            <DialogDescription>
              {scope?.kind === "program"
                ? "Program managers see the members of every team in this program, including teams added later."
                : "Team managers see the members of this team."}
            </DialogDescription>
          </DialogHeader>

          {inheritedNames.length > 0 && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-caption text-muted-foreground">
              Also managed via <span className="font-medium text-foreground">{scope?.programName ?? "program"}</span>:{" "}
              {inheritedNames.join(", ")}.
            </p>
          )}

          <ScopeManagersField
            key={currentKey ?? "closed"}
            candidates={candidates}
            selected={managerIds}
            inheritedIds={scope?.inheritedManagerIds}
            onChange={setManagerIds}
          />

          {error && (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={handleCloseRequest}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={handleSave}>
              {pending ? "Saving…" : "Save managers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog open={confirmDiscard} onOpenChange={setConfirmDiscard} onDiscard={closeClean} />
    </>
  );
}
