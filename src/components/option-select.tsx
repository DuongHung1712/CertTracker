"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SelectOption = { id: string; name: string };

/** Single select over `{ id, name }` options. The select value renders the raw id by default, so it is mapped back to the name. */
export function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  invalid?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(next) => next !== null && onChange(next)}>
      <SelectTrigger id={id} aria-invalid={invalid}>
        <SelectValue placeholder={placeholder}>
          {(selected: string) => options.find((option) => option.id === selected)?.name ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
