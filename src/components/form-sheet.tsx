"use client";

import { useState, type FormEventHandler, type ReactNode } from "react";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Side sheet around a form: title, scrolling fields, a root error line, and Cancel / Save. */
export function FormSheet({
  open,
  onOpenChange,
  title,
  onSubmit,
  rootError,
  submitting,
  submitDisabled = false,
  dirty = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  rootError?: string;
  submitting: boolean;
  /** A known blocker the form already explains (e.g. a duplicate); Enter is still guarded by onSubmit. */
  submitDisabled?: boolean;
  /** The form holds unsaved input: closing it by Cancel, Esc, a click outside or the X asks first. A successful save closes through `onOpenChange` itself. */
  dirty?: boolean;
  children: ReactNode;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  function requestOpenChange(next: boolean) {
    if (!next && dirty) setConfirmDiscard(true);
    else onOpenChange(next);
  }
  return (
    <Sheet open={open} onOpenChange={requestOpenChange}>
      {/* data-[side=right]:w-full overrides the primitive's w-3/4, so phones get the full width. */}
      <SheetContent className="flex w-full flex-col data-[side=right]:w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-section-title">{title}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto px-4" onSubmit={onSubmit}>
          {children}
          {rootError && (
            <p role="alert" className="text-caption text-destructive">
              {rootError}
            </p>
          )}
          {/* Sticky so Save stays on screen however long the form is. */}
          <SheetFooter className="sticky bottom-0 mt-auto flex-row justify-end gap-2 border-t border-border bg-popover px-0 pt-2 pb-4">
            <Button type="button" variant="outline" onClick={() => requestOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || submitDisabled}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
      <DiscardChangesDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        onDiscard={() => {
          setConfirmDiscard(false);
          onOpenChange(false);
        }}
      />
    </Sheet>
  );
}
