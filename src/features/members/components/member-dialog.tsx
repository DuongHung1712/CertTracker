"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createMember, updateMember } from "@/features/members/actions";
import { memberSchema, type MemberInput } from "@/features/members/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type TeamOption = { id: string; name: string };
type Editing = { id: string; fullName: string; email: string; teamId: string | null; isActive: boolean } | null;

export function MemberDialog({
  open,
  onOpenChange,
  editing,
  teams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  teams: TeamOption[];
}) {
  // `memberSchema`'s `isActive` has a zod `.default(true)`, so its input type
  // (`isActive?: boolean`) and output type (`isActive: boolean`, after
  // MemberInput) differ. Typing the three generics explicitly — instead of
  // just `useForm<MemberInput>`, which forces the input type to match the
  // output type and fails to compile — tells react-hook-form to accept the
  // input shape as field values and hand `onSubmit` the resolved output.
  const form = useForm<z.input<typeof memberSchema>, unknown, MemberInput>({
    resolver: zodResolver(memberSchema),
    values: {
      fullName: editing?.fullName ?? "",
      email: editing?.email ?? "",
      teamId: editing?.teamId ?? "",
      isActive: editing?.isActive ?? true,
    },
  });

  async function onSubmit(values: MemberInput) {
    const result = editing ? await updateMember({ id: editing.id, ...values }) : await createMember(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? `Đã lưu thành viên ${values.fullName}` : `Đã thêm thành viên ${values.fullName}`);
    onOpenChange(false);
    form.reset({ fullName: "", email: "", teamId: "", isActive: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa thành viên" : "Thêm thành viên"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="member-name">Họ tên</FieldLabel>
            <Input id="member-name" {...form.register("fullName")} aria-invalid={!!form.formState.errors.fullName} />
            <FieldError errors={[form.formState.errors.fullName]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="member-email">Email</FieldLabel>
            <Input id="member-email" type="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="member-team">Team</FieldLabel>
            <Controller
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="member-team" aria-invalid={!!form.formState.errors.teamId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the team name. */}
                    <SelectValue placeholder="Chọn team">
                      {(value: string) => teams.find((team) => team.id === value)?.name ?? "Chọn team"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.teamId]} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="member-active">Đang hoạt động</FieldLabel>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => <Switch id="member-active" checked={field.value} onCheckedChange={field.onChange} />}
            />
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
