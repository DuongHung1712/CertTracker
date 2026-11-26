"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { RequiredMark } from "@/components/required-mark";
import { createDc, updateDc } from "@/features/organizations/actions";
import { dcSchema, type DcInput } from "@/features/organizations/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function DcDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: { id: string; name: string } | null;
}) {
  const defaultValues = useMemo(() => ({ name: editing?.name ?? "" }), [editing]);
  const form = useForm<DcInput>({ resolver: zodResolver(dcSchema), values: defaultValues });
  const { isDirty } = form.formState; // read in render so RHF subscribes
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function closeClean() {
    form.reset(defaultValues);
    form.clearErrors();
    setConfirmDiscard(false);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (form.formState.isSubmitting) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    closeClean();
  }

  async function onSubmit(values: DcInput) {
    const result = editing ? await updateDc({ id: editing.id, ...values }) : await createDc(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Saved centre ${values.name}` : `Added centre ${values.name}`);
    closeClean();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-section-title">{editing ? "Edit centre" : "Add centre"}</DialogTitle>
          </DialogHeader>
          <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
            <p className="text-caption text-muted-foreground">* Required</p>
            <Field>
              <FieldLabel htmlFor="dc-name">
                Centre name <RequiredMark />
              </FieldLabel>
              <Input
                id="dc-name"
                className="h-9"
                {...form.register("name")}
                aria-required="true"
                aria-invalid={!!form.formState.errors.name}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            {form.formState.errors.root && (
              <p role="alert" className="text-caption text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog open={confirmDiscard} onOpenChange={setConfirmDiscard} onDiscard={closeClean} />
    </>
  );
}
