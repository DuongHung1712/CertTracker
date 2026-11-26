"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { RequiredMark } from "@/components/required-mark";
import { createTeam, updateTeam } from "@/features/organizations/actions";
import { teamSchema, type TeamInput } from "@/features/organizations/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProgramOption = { id: string; name: string };
type Editing = { id: string; name: string; programId: string } | null;

export function TeamDialog({
  open,
  onOpenChange,
  editing,
  programs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  programs: ProgramOption[];
}) {
  const defaultValues = useMemo(
    () => ({ name: editing?.name ?? "", programId: editing?.programId ?? "" }),
    [editing],
  );
  const form = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    values: defaultValues,
  });
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

  async function onSubmit(values: TeamInput) {
    const result = editing ? await updateTeam({ id: editing.id, ...values }) : await createTeam(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? `Saved team ${values.name}` : `Added team ${values.name}`);
    closeClean();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-section-title">{editing ? "Edit team" : "Add team"}</DialogTitle>
          </DialogHeader>
          <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
            <p className="text-caption text-muted-foreground">* Required</p>
            <Field>
              <FieldLabel htmlFor="team-name">
                Team name <RequiredMark />
              </FieldLabel>
              <Input
                id="team-name"
                className="h-9"
                {...form.register("name")}
                aria-required="true"
                aria-invalid={!!form.formState.errors.name}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="team-program">
                Program <RequiredMark />
              </FieldLabel>
              <Controller
                control={form.control}
                name="programId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="team-program"
                      size="lg"
                      className="w-full"
                      aria-required="true"
                      aria-invalid={!!form.formState.errors.programId}
                    >
                      {/* Base UI's SelectValue renders the raw value by default; map it back to the program name. */}
                      <SelectValue placeholder="Choose a program">
                        {(value: string) => programs.find((program) => program.id === value)?.name ?? "Choose a program"}
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
            {form.formState.errors.root && (
              <p role="alert" className="text-caption text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
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
