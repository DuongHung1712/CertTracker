"use client";

import { Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyName } from "@/features/profile/actions";

/** The Name row of the Account card: text with an edit button, or an inline form. */
export function NameField({ fullName }: { fullName: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateMyName, null);
  const [value, setValue] = useState(fullName);
  // The result a Cancel dismissed: an error belongs to one editing session only.
  const [dismissed, setDismissed] = useState(state);
  const failed = state !== null && !state.ok && state !== dismissed;
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  const open = () => {
    setValue(fullName);
    setEditing(true);
  };
  const cancel = () => {
    setDismissed(state);
    setEditing(false);
  };

  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  // Close the editor when a save succeeds (adjusting state during render, not in an effect).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setEditing(false);
  }

  useEffect(() => {
    if (state?.ok) toast.success("Name updated");
  }, [state]);

  if (!editing) {
    return (
      <div className="flex items-center gap-1">
        <span>{fullName}</span>
        <Button type="button" variant="ghost" size="sm" aria-label="Edit name" ref={editButton} onClick={open}>
          <Pencil className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-1.5"
      onKeyDown={(e) => e.key === "Escape" && cancel()}
    >
      <Label htmlFor="profile-full-name" className="sr-only">
        Name
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id="profile-full-name"
          name="fullName"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="name"
          autoFocus
          className="h-9 w-64"
          aria-invalid={failed || undefined}
          aria-describedby={failed ? "profile-name-error" : undefined}
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={cancel}>
          Cancel
        </Button>
      </div>
      {failed && <FieldError id="profile-name-error">{state.error}</FieldError>}
    </form>
  );
}
