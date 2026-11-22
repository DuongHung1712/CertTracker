"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Confirmation. The title names the object; the button names the action; it is destructive (red) unless `variant` says otherwise. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  pendingLabel,
  onConfirm,
  pending = false,
  confirmDisabled = false,
  variant = "destructive",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** The button that keeps things as they are; "Keep editing" where a plain Cancel could be mistaken for the form's own. */
  cancelLabel?: string;
  /** Shown on the confirm button while `pending`. Defaults to "Working…". */
  pendingLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  /** The action is not possible (the description says why), so only Cancel works. */
  confirmDisabled?: boolean;
  variant?: "destructive" | "default";
  /** Extra content under the description, e.g. a list of what will be created; it scrolls when long. */
  children?: React.ReactNode;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Ignore Esc / backdrop / Cancel while the destructive action is in
        // flight — otherwise the dialog can be dismissed mid-request.
        if (pending && !nextOpen) return;
        onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className={cn(children && "data-[size=default]:sm:max-w-lg")}>
        <AlertDialogHeader className="min-w-0">
          <AlertDialogTitle className="text-section-title wrap-anywhere">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-body wrap-anywhere">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children && <div className="max-h-[45vh] min-w-0 overflow-y-auto">{children}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button variant={variant} disabled={pending || confirmDisabled} onClick={onConfirm}>
            {pending ? (pendingLabel ?? "Working…") : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
