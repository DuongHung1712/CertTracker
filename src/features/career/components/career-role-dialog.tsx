"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
  const form = useForm<CareerRoleInput>({ resolver: zodResolver(careerRoleSchema), values: { name: editing?.name ?? "" } });

  async function onSubmit(values: CareerRoleInput) {
    const result = editing ? await updateCareerRole({ id: editing.id, ...values }) : await createCareerRole(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Saved role ${values.name}` : `Added role ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Rename career role" : "Add career role"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="career-role-name">Role name</FieldLabel>
            <Input id="career-role-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
