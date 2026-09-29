"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { createTeam, setTeamManagers, updateTeam } from "@/features/organizations/actions";
import { teamSchema, type TeamInput } from "@/features/organizations/schema";
import { TeamManagersField } from "@/features/organizations/components/team-managers-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProgramOption = { id: string; name: string };
type Candidate = { userId: string; fullName: string; email: string };
type Editing = { id: string; name: string; programId: string; managerIds: string[] } | null;

export function TeamDialog({
  open,
  onOpenChange,
  editing,
  programs,
  candidates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  programs: ProgramOption[];
  candidates: Candidate[];
}) {
  const form = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    values: { name: editing?.name ?? "", programId: editing?.programId ?? "" },
  });
  const [managerIds, setManagerIds] = useState<string[]>(editing?.managerIds ?? []);
  // Reset managerIds when the dialog switches to a different team (or between
  // add/edit) — adjusted during render, per React's guidance, instead of in a
  // useEffect (which would cause an extra render and trip
  // react-hooks/set-state-in-effect).
  const [resetKey, setResetKey] = useState(editing?.id ?? null);
  if (resetKey !== (editing?.id ?? null)) {
    setResetKey(editing?.id ?? null);
    setManagerIds(editing?.managerIds ?? []);
  }

  async function onSubmit(values: TeamInput) {
    const result = editing ? await updateTeam({ id: editing.id, ...values }) : await createTeam(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    if (editing) {
      const managerResult = await setTeamManagers({ teamId: editing.id, userIds: managerIds });
      if (!managerResult.ok) {
        toast.error(managerResult.error);
        return;
      }
    }
    toast.success(editing ? `Đã lưu team ${values.name}` : `Đã thêm team ${values.name}`);
    onOpenChange(false);
    form.reset({ name: "", programId: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Sửa team" : "Thêm team"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="team-name">Tên team</FieldLabel>
            <Input id="team-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="team-program">Chương trình</FieldLabel>
            <Controller
              control={form.control}
              name="programId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="team-program" aria-invalid={!!form.formState.errors.programId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the program name. */}
                    <SelectValue placeholder="Chọn chương trình">
                      {(value: string) => programs.find((program) => program.id === value)?.name ?? "Chọn chương trình"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.programId]} />
          </Field>
          {editing && (
            <Field>
              <FieldLabel>Quản lý team</FieldLabel>
              <TeamManagersField candidates={candidates} selected={managerIds} onChange={setManagerIds} />
            </Field>
          )}
          {!editing && (
            <p className="text-caption text-muted-foreground">Gán quản lý sau khi lưu team.</p>
          )}
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
