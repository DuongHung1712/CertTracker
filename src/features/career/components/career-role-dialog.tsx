"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { RequiredMark } from "@/components/required-mark";
import { createCareerRole, updateCareerRole } from "@/features/career/actions";
import { careerRoleSchema, type CareerRoleInput } from "@/features/career/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CareerRoleDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: { id: string; name: string } | null;
}) {
  const values = useMemo(() => ({ name: editing?.name ?? "" }), [editing]);
  const form = useForm<CareerRoleInput>({ resolver: zodResolver(careerRoleSchema), values });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset(values);
    onOpenChange(next);
  }

  async function onSubmit(values: CareerRoleInput) {
    const result = editing ? await updateCareerRole({ id: editing.id, ...values }) : await createCareerRole(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Saved role ${values.name}` : `Added role ${values.name}`);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Rename career role" : "Add career role"}</DialogTitle>
        </DialogHeader>
        <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <p className="text-caption text-muted-foreground">* Required</p>
          <Field>
            <FieldLabel htmlFor="career-role-name">
              Role name <RequiredMark />
            </FieldLabel>
            <Input
              id="career-role-name"
              className="h-9"
              aria-required="true"
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
