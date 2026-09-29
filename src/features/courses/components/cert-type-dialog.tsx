"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createCertType, updateCertType } from "@/features/courses/actions";
import { certTypeSchema, type CertTypeInput } from "@/features/courses/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CertTypeDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: { id: string; name: string } | null;
}) {
  const form = useForm<CertTypeInput>({ resolver: zodResolver(certTypeSchema), values: { name: editing?.name ?? "" } });

  async function onSubmit(values: CertTypeInput) {
    const result = editing ? await updateCertType({ id: editing.id, ...values }) : await createCertType(values);
    if (!result.ok) {
      form.setError("name", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu loại chứng chỉ ${values.name}` : `Đã thêm loại chứng chỉ ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa loại chứng chỉ" : "Thêm loại chứng chỉ"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="cert-type-name">Tên loại chứng chỉ</FieldLabel>
            <Input id="cert-type-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
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
