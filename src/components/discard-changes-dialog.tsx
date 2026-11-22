"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";

/** Asked when a form with unsaved input is closed (Cancel, Esc, a click outside, the X), so typed text and an AI read are not lost by accident. */
export function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Discard your changes?"
      description="What you entered on this form will be lost."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      onConfirm={onDiscard}
    />
  );
}
