"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createCourse, updateCourse } from "@/features/courses/actions";
import { courseSchema, type CourseInput } from "@/features/courses/schema";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { CURRENCIES, toCurrency } from "@/lib/money";

type Option = { id: string; name: string };
type Editing = (CourseInput & { id: string }) | null;

export function CourseSheet({
  open,
  onOpenChange,
  editing,
  certTypes,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  certTypes: Option[];
  providers: Option[];
}) {
  const empty: CourseInput = {
    name: "",
    certTypeId: "",
    providerId: "",
    level: "",
    validityMonths: null,
    refundable: false,
    cost: null,
    costCurrency: null,
    estHours: null,
    url: null,
  };
  // `courseSchema` has `.default()` fields (`level`, `refundable`) and several `z.preprocess`-based
  // nullable fields, so its input type (pre-parse) and output type (CourseInput, post-parse) diverge.
  // The three explicit generics tell react-hook-form to accept the input shape as field values and
  // hand `onSubmit` the resolved output — same fix as member-dialog.tsx's `memberSchema`.
  const form = useForm<z.input<typeof courseSchema>, unknown, CourseInput>({
    resolver: zodResolver(courseSchema),
    values: editing ?? empty,
  });

  async function onSubmit(values: CourseInput) {
    const result = editing ? await updateCourse({ id: editing.id, ...values }) : await createCourse(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? `Saved course ${values.name}` : `Added course ${values.name}`);
    onOpenChange(false);
    form.reset(empty);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-section-title">{editing ? "Edit course" : "Add course"}</SheetTitle>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field>
            <FieldLabel htmlFor="course-name">Course name</FieldLabel>
            <Input id="course-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-cert-type">Certificate type</FieldLabel>
            <Controller
              control={form.control}
              name="certTypeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="course-cert-type" aria-invalid={!!form.formState.errors.certTypeId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the cert type name. */}
                    <SelectValue placeholder="Choose a certificate type">
                      {(value: string) => certTypes.find((option) => option.id === value)?.name ?? "Choose a certificate type"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {certTypes.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.certTypeId]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-provider">Provider</FieldLabel>
            <Controller
              control={form.control}
              name="providerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="course-provider" aria-invalid={!!form.formState.errors.providerId}>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the provider name. */}
                    <SelectValue placeholder="Choose a provider">
                      {(value: string) => providers.find((option) => option.id === value)?.name ?? "Choose a provider"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[form.formState.errors.providerId]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-level">Level</FieldLabel>
            <Input id="course-level" {...form.register("level")} placeholder="Associate, Professional…" />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-validity">Validity (months)</FieldLabel>
            <Input
              id="course-validity"
              type="number"
              min={1}
              {...form.register("validityMonths")}
              placeholder="Leave empty if it does not expire"
              aria-invalid={!!form.formState.errors.validityMonths}
            />
            <FieldError errors={[form.formState.errors.validityMonths]} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="course-refundable">Refundable</FieldLabel>
            <Controller
              control={form.control}
              name="refundable"
              render={({ field }) => <Switch id="course-refundable" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </Field>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Field>
              <FieldLabel htmlFor="course-cost">Cost</FieldLabel>
              <Input
                id="course-cost"
                type="number"
                min={0}
                step="any"
                {...form.register("cost")}
                aria-invalid={!!form.formState.errors.cost}
              />
              <FieldError errors={[form.formState.errors.cost]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="course-currency">Currency</FieldLabel>
              <Controller
                control={form.control}
                name="costCurrency"
                render={({ field }) => (
                  <>
                    <Select
                      value={toCurrency(typeof field.value === "string" ? field.value : null)}
                      onValueChange={(value) => field.onChange(toCurrency(value))}
                    >
                      <SelectTrigger id="course-currency" aria-invalid={!!form.formState.errors.costCurrency}>
                        <SelectValue placeholder="Currency">{(value: string | null) => value ?? "Currency"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.value ? (
                      <Button type="button" variant="ghost" size="xs" className="self-start" onClick={() => field.onChange(null)}>
                        Clear currency
                      </Button>
                    ) : null}
                  </>
                )}
              />
              <FieldError errors={[form.formState.errors.costCurrency]} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="course-hours">Study hours (estimate)</FieldLabel>
            <Input
              id="course-hours"
              type="number"
              min={1}
              {...form.register("estHours")}
              aria-invalid={!!form.formState.errors.estHours}
            />
            <FieldError errors={[form.formState.errors.estHours]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="course-url">Course link</FieldLabel>
            <Input id="course-url" type="url" {...form.register("url")} aria-invalid={!!form.formState.errors.url} />
            <FieldError errors={[form.formState.errors.url]} />
          </Field>
          {form.formState.errors.root && (
            <p role="alert" className="text-caption text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <SheetFooter className="flex-row justify-end gap-2 px-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
