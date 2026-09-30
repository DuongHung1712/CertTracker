"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { foldText } from "@/lib/text";

export type ComboboxOption = { id: string; label: string; hint?: string };

/** Diacritic-insensitive match on label + hint, so `nguyen` finds `Nguyễn`. */
function matches(option: ComboboxOption, query: string): boolean {
  return foldText(`${option.label} ${option.hint ?? ""}`).includes(foldText(query));
}

/**
 * Searchable single-select over `{ id, label, hint }` options. The form value is the option `id`;
 * the control always displays the label. An `id` that is not in `options` (e.g. a deactivated
 * member) is treated as empty and shows the placeholder.
 */
export function EntityCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  emptyText,
  disabled,
  "aria-invalid": ariaInvalid,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  options: ComboboxOption[];
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}) {
  // Base UI resolves the displayed text from the selected *item*, so pass the option object
  // rather than the id — otherwise the closed control would show the raw id.
  const selected = options.find((option) => option.id === value) ?? null;

  return (
    <Combobox<ComboboxOption>
      items={options}
      value={selected}
      onValueChange={(option) => onChange(option?.id ?? "")}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.id === b.id}
      filter={matches}
      disabled={disabled}
      autoHighlight
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: ComboboxOption) => (
            <ComboboxItem key={option.id} value={option}>
              <span className="truncate">{option.label}</span>
              {option.hint ? (
                <span className="truncate text-caption text-muted-foreground">{option.hint}</span>
              ) : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
