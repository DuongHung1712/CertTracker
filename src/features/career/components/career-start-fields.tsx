"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/features/career/format";

export const NO_MONTH = "none";

export type CareerStartDraft = { year: string; month: string };

/** Form text → the shape the schema expects: no month → null (January), blank year → empty string (rejected by the schema). */
export function toCareerStartInput({ year, month }: CareerStartDraft) {
  return { year: year.trim(), month: month === NO_MONTH ? null : Number(month) };
}

/** Month (optional) + year of the first job. Shared by the member's own page and the admin's member form. */
export function CareerStartFields({
  idPrefix,
  value,
  onChange,
  error,
  disabled = false,
}: {
  idPrefix: string;
  value: CareerStartDraft;
  onChange: (value: CareerStartDraft) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Field className="w-44">
        <FieldLabel htmlFor={`${idPrefix}-month`}>Month (optional)</FieldLabel>
        <Select value={value.month} onValueChange={(month) => onChange({ ...value, month: month ?? NO_MONTH })} disabled={disabled}>
          <SelectTrigger id={`${idPrefix}-month`} className="h-9 w-full" aria-invalid={!!error}>
            <SelectValue>
              {(month: string) => (month === NO_MONTH ? "No month" : (MONTH_NAMES[Number(month) - 1] ?? "No month"))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_MONTH}>No month</SelectItem>
            {MONTH_NAMES.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-28">
        <FieldLabel htmlFor={`${idPrefix}-year`}>Year</FieldLabel>
        <Input
          id={`${idPrefix}-year`}
          className="h-9"
          inputMode="numeric"
          placeholder="2020"
          value={value.year}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(event) => onChange({ ...value, year: event.target.value })}
        />
      </Field>
      {error && (
        <div className="basis-full">
          <FieldError errors={[{ message: error }]} />
        </div>
      )}
    </div>
  );
}
