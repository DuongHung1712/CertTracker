"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  CareerStartFields,
  NO_MONTH,
  toCareerStartInput,
  type CareerStartDraft,
} from "@/features/career/components/career-start-fields";
import { formatCareerStart, formatYoe } from "@/features/career/format";
import { dateToCareerStart, makeCareerStartSchema } from "@/features/career/schema";
import { ROLE_LABEL, type Role } from "@/components/status/labels";
import { createMember, setMemberAccess, updateMember } from "@/features/members/actions";
import { memberSchema, type MemberInput } from "@/features/members/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type TeamOption = { id: string; name: string };
type RoleOption = { id: string; name: string };
type Editing = {
  id: string;
  fullName: string;
  email: string;
  teamId: string | null;
  isActive: boolean;
  userId: string | null;
  accessRole: Role | null;
  careerRoleId: string | null;
  careerRoleName: string | null;
  careerStart: string | null;
  yoeYears: number | null;
} | null;

const NO_ROLE = "none";

function careerDraftFor(editing: Editing): { roleId: string; start: CareerStartDraft } {
  const { year, month } = dateToCareerStart(editing?.careerStart ?? null);
  return {
    roleId: editing?.careerRoleId ?? NO_ROLE,
    start: { year: year === null ? "" : String(year), month: month === null ? NO_MONTH : String(month) },
  };
}

export function MemberDialog({
  open,
  onOpenChange,
  editing,
  teams,
  roles,
  canEditCareer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  teams: TeamOption[];
  roles: RoleOption[];
  /** Admin only. Managers see the career role and start read-only (the database rejects their changes). */
  canEditCareer: boolean;
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
  const [career, setCareer] = useState(() => careerDraftFor(editing));
  const [careerError, setCareerError] = useState<string | undefined>();
  const [access, setAccess] = useState(editing?.accessRole ?? null);
  // Start from the member being edited each time the dialog opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setCareer(careerDraftFor(editing));
      setCareerError(undefined);
      setAccess(editing?.accessRole ?? null);
    }
  }

  async function onSubmit(values: MemberInput) {
    let careerFields: Pick<MemberInput, "careerRoleId" | "careerStart"> = {};
    if (canEditCareer) {
      const blank = career.start.year.trim() === "" && career.start.month === NO_MONTH;
      const start = blank ? null : makeCareerStartSchema(new Date()).safeParse(toCareerStartInput(career.start));
      if (start && !start.success) {
        setCareerError(start.error.issues[0]?.message);
        return;
      }
      setCareerError(undefined);
      careerFields = {
        careerRoleId: career.roleId === NO_ROLE ? null : career.roleId,
        careerStart: start ? start.data : null,
      };
    }
    const input = { ...values, ...careerFields };
    const result = editing ? await updateMember({ id: editing.id, ...input }) : await createMember(input);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    if (editing?.userId && access && access !== editing.accessRole) {
      const accessResult = await setMemberAccess({ userId: editing.userId, role: access });
      if (!accessResult.ok) {
        form.setError("root", { message: accessResult.error });
        return;
      }
    }
    toast.success(editing ? `Saved member ${values.fullName}` : `Added member ${values.fullName}`);
    onOpenChange(false);
    form.reset({ fullName: "", email: "", teamId: "", isActive: true });
    setCareer(careerDraftFor(null));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-section-title">{editing ? "Edit member" : "Add member"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="member-name">Full name</FieldLabel>
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
                    <SelectValue placeholder="Choose a team">
                      {(value: string) => teams.find((team) => team.id === value)?.name ?? "Choose a team"}
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
          {canEditCareer && editing && (
            <Field>
              <FieldLabel htmlFor="member-access">Access</FieldLabel>
              {access ? (
                <Select value={access} onValueChange={(role) => setAccess(role ?? access)}>
                  <SelectTrigger id="member-access" className="w-full">
                    <SelectValue>{(value: Role) => ROLE_LABEL[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-caption text-muted-foreground">No account yet. New accounts start as Member.</p>
              )}
            </Field>
          )}
          {canEditCareer ? (
            <>
              <Field>
                <FieldLabel htmlFor="member-career-role">Career role</FieldLabel>
                <Select value={career.roleId} onValueChange={(roleId) => setCareer({ ...career, roleId: roleId ?? NO_ROLE })}>
                  <SelectTrigger id="member-career-role" className="w-full">
                    <SelectValue>{(value: string) => roles.find((role) => role.id === value)?.name ?? "Not set"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ROLE}>Not set</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex flex-col gap-2">
                <p className="text-body font-medium">Started working</p>
                <CareerStartFields
                  idPrefix="member-career"
                  value={career.start}
                  onChange={(start) => setCareer({ ...career, start })}
                  error={careerError}
                />
              </div>
            </>
          ) : (
            editing && (
              <dl className="flex flex-wrap gap-x-10 gap-y-3" data-testid="career-readonly">
                <div>
                  <dt className="text-caption text-muted-foreground">Career role</dt>
                  <dd>{editing.careerRoleName ?? "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">Started working</dt>
                  <dd>
                    {formatCareerStart(editing.careerStart)} ({formatYoe(editing.yoeYears)})
                  </dd>
                </div>
              </dl>
            )
          )}
          <Field orientation="horizontal">
            <FieldLabel htmlFor="member-active">Active</FieldLabel>
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
