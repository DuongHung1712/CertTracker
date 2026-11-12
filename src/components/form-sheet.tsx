"use client";

import type { FormEventHandler, ReactNode } from "react";
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
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  rootError?: string;
  submitting: boolean;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-section-title">{title}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4" onSubmit={onSubmit}>
          {children}
          {rootError && (
            <p role="alert" className="text-caption text-destructive">
              {rootError}
            </p>
          )}
          <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
