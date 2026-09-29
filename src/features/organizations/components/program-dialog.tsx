"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { createProgram, updateProgram } from "@/features/organizations/actions";
import { programSchema, type ProgramInput } from "@/features/organizations/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DcOption = { id: string; name: string };
type Editing = { id: string; name: string; dcId: string } | null;

export function ProgramDialog({
  open,
  onOpenChange,
  editing,
  dcs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  dcs: DcOption[];
}) {
  const form = useForm<ProgramInput>({
    resolver: zodResolver(programSchema),
    values: { name: editing?.name ?? "", dcId: editing?.dcId ?? "" },
  });

  async function onSubmit(values: ProgramInput) {
    const result = editing ? await updateProgram({ id: editing.id, ...values }) : await createProgram(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu chương trình ${values.name}` : `Đã thêm chương trình ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "", dcId: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa chương trình" : "Thêm chương trình"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="program-name">Tên chương trình</FieldLabel>
            <Input id="program-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="program-dc">Trung tâm</FieldLabel>
            <Controller
              control={form.control}
              name="dcId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="program-dc" aria-invalid={!!form.formState.errors.dcId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the DC name. */}
                    <SelectValue placeholder="Chọn trung tâm">
                      {(value: string) => dcs.find((dc) => dc.id === value)?.name ?? "Chọn trung tâm"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {dcs.map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        {dc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.dcId]} />
          </Field>
          {form.formState.errors.root && (
            <p role="alert" className="text-caption text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
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
