"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createProvider, updateProvider } from "@/features/courses/actions";
import { providerSchema, type ProviderInput } from "@/features/courses/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/required-mark";

export function ProviderDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: { id: string; name: string } | null;
}) {
  const form = useForm<ProviderInput>({ resolver: zodResolver(providerSchema), values: { name: editing?.name ?? "" } });

  async function onSubmit(values: ProviderInput) {
    const result = editing ? await updateProvider({ id: editing.id, ...values }) : await createProvider(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Saved provider ${values.name}` : `Added provider ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "" });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ name: editing?.name ?? "" });
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Edit provider" : "Add provider"}</DialogTitle>
        </DialogHeader>
        <p className="text-caption text-muted-foreground">* Required</p>
        <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="provider-name">
              Provider name <RequiredMark />
            </FieldLabel>
            <Input
              id="provider-name"
              aria-required
              className="h-9"
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset({ name: editing?.name ?? "" });
                onOpenChange(false);
              }}
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
  );
}
