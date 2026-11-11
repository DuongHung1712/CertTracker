"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createCourse, updateCourse } from "@/features/courses/actions";
import { courseSchema, type CourseInput } from "@/features/courses/schema";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormSheet } from "@/components/form-sheet";
import { RequiredMark } from "@/components/required-mark";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CURRENCIES, toCurrency } from "@/lib/money";

const NONE = "none";
type Editing = (CourseInput & { id: string }) | null;

export function CourseSheet({
  open,
  onOpenChange,
  editing,
  certificates,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  /** Exam certificates a course can prepare for. */
  certificates: SelectOption[];
  providers: SelectOption[];
}) {
  const empty: CourseInput = {
    name: "",
    providerId: "",
    preparesForId: null,
    refundable: false,
    cost: null,
    costCurrency: null,
    estHours: null,
    url: null,
    refundConditions: null,
  };
  // `courseSchema` has `.default()` fields (`refundable`) and several `z.preprocess`-based
  // nullable fields, so its input type (pre-parse) and output type (CourseInput, post-parse) diverge.
  // The three explicit generics tell react-hook-form to accept the input shape as field values and
  // hand `onSubmit` the resolved output — same fix as member-dialog.tsx's `memberSchema`.
  const form = useForm<z.input<typeof courseSchema>, unknown, CourseInput>({
    resolver: zodResolver(courseSchema),
    values: editing ?? empty,
  });

  const refundable = useWatch({ control: form.control, name: "refundable" });

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
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit course" : "Add course"}
      onSubmit={form.handleSubmit(onSubmit)}
      rootError={form.formState.errors.root?.message}
      submitting={form.formState.isSubmitting}
    >
      <Field>
        <FieldLabel htmlFor="course-name">
          Name <RequiredMark />
        </FieldLabel>
        <Input
          id="course-name"
          className="h-9"
          {...form.register("name")}
          aria-invalid={!!form.formState.errors.name}
        />
        <FieldError errors={[form.formState.errors.name]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="course-provider">
          Provider <RequiredMark />
        </FieldLabel>
        <Controller
          control={form.control}
          name="providerId"
          render={({ field }) => (
            <OptionSelect
              id="course-provider"
              value={field.value}
              onChange={field.onChange}
              options={providers}
              placeholder="Choose a provider"
              invalid={!!form.formState.errors.providerId}
            />
          )}
        />
        <FieldError errors={[form.formState.errors.providerId]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="course-prepares-for">Prepares for</FieldLabel>
        <Controller
          control={form.control}
          name="preparesForId"
          render={({ field }) => (
            <OptionSelect
              id="course-prepares-for"
              value={typeof field.value === "string" && field.value ? field.value : NONE}
              onChange={(value) => field.onChange(value === NONE ? null : value)}
              options={[{ id: NONE, name: "None" }, ...certificates]}
              placeholder="None"
              invalid={!!form.formState.errors.preparesForId}
            />
          )}
        />
        <FieldError errors={[form.formState.errors.preparesForId]} />
      </Field>
      <Field orientation="horizontal">
        <FieldLabel htmlFor="course-refundable">Refundable</FieldLabel>
        <Controller
          control={form.control}
          name="refundable"
          render={({ field }) => (
            <Switch
              id="course-refundable"
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                // Hidden stale text must never block Save with the length error.
                if (!checked) {
                  form.setValue("refundConditions", "");
                  form.clearErrors("refundConditions");
                }
              }}
            />
          )}
        />
      </Field>
      {refundable && (
        <Field>
          <FieldLabel htmlFor="course-refund-conditions">Refund conditions</FieldLabel>
          <Textarea
            id="course-refund-conditions"
            {...form.register("refundConditions")}
            aria-invalid={!!form.formState.errors.refundConditions}
          />
          <FieldError errors={[form.formState.errors.refundConditions]} />
        </Field>
      )}
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field>
          <FieldLabel htmlFor="course-cost">Cost</FieldLabel>
          <Input
            id="course-cost"
            type="number"
            min={0}
            step="any"
            className="h-9"
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
                  <SelectTrigger id="course-currency" size="lg" aria-invalid={!!form.formState.errors.costCurrency}>
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
        <FieldLabel htmlFor="course-hours">Duration (hours)</FieldLabel>
        <Input
          id="course-hours"
          type="number"
          min={1}
          className="h-9"
          {...form.register("estHours")}
          aria-invalid={!!form.formState.errors.estHours}
        />
        <FieldError errors={[form.formState.errors.estHours]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="course-url">Course link</FieldLabel>
        <Input id="course-url" type="url" className="h-9" {...form.register("url")} aria-invalid={!!form.formState.errors.url} />
        <FieldError errors={[form.formState.errors.url]} />
      </Field>
    </FormSheet>
  );
}
