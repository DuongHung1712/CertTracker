"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
  const form = useForm<DcInput>({ resolver: zodResolver(dcSchema), values: { name: editing?.name ?? "" } });

  async function onSubmit(values: DcInput) {
    const result = editing ? await updateDc({ id: editing.id, ...values }) : await createDc(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu trung tâm ${values.name}` : `Đã thêm trung tâm ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa trung tâm" : "Thêm trung tâm"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="dc-name">Tên trung tâm</FieldLabel>
            <Input id="dc-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
