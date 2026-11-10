"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { RequiredMark } from "@/components/required-mark";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDateInput } from "@/lib/date-input";
import { toIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";

export function DateField({
  id,
  label,
  value,
  onChange,
  onBlur,
  max,
  invalid,
  required,
  describedBy,
  name,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** `YYYY-MM-DD`; limits the calendar only, the schema still decides what is valid. */
  max?: string;
  invalid?: boolean;
  required?: boolean;
  /** Id of a `FieldDescription` under the field. */
  describedBy?: string;
  name?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function openCalendar() {
    const picker = pickerRef.current;
    if (!picker) return;
    const iso = toIsoDate(value);
    // A value above `max` would make the hidden input invalid for the whole form.
    picker.value = iso && (!max || iso <= max) ? iso : "";
    try {
      picker.showPicker();
    } catch {
      picker.focus();
    }
  }

  return (
    <>
      <FieldLabel htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </FieldLabel>
      <div className="relative">
        <Input
          id={id}
          name={name}
          value={value}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          maxLength={10}
          className="h-9 pr-10"
          aria-invalid={invalid}
          aria-required={required}
          aria-describedby={describedBy}
          onChange={(event) => {
            if (pickerRef.current) pickerRef.current.value = "";
            onChange(formatDateInput(event.target.value));
          }}
          onBlur={onBlur}
        />
        <button
          type="button"
          aria-label={`Choose ${label} from calendar`}
          onClick={openCalendar}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <CalendarDays className="size-4" aria-hidden />
        </button>
        <input
          ref={pickerRef}
          type="date"
          max={max}
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute right-0 bottom-0 size-0 opacity-0"
          onChange={(event) => {
            if (event.target.value) onChange(formatDate(event.target.value));
          }}
        />
      </div>
    </>
  );
}
