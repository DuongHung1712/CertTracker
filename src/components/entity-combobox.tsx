"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { foldText } from "@/lib/text";

/** `group`, when set on the options, lists them under that heading; groups appear in order of first use. */
export type ComboboxOption = { id: string; label: string; hint?: string; group?: string };
type OptionGroup = { value: string; items: ComboboxOption[] };

function groupOptions(options: ComboboxOption[]): OptionGroup[] {
  const groups = new Map<string, ComboboxOption[]>();
  for (const option of options) groups.set(option.group ?? "", [...(groups.get(option.group ?? "") ?? []), option]);
  return [...groups].map(([value, items]) => ({ value, items }));
}

/** Diacritic-insensitive match on label + hint, so a search for `nguyen` finds a name with accents. */
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
  emptyAction,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-required": ariaRequired,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  options: ComboboxOption[];
  placeholder: string;
  emptyText: string;
  emptyAction?: { label: string; onClick: (query?: string) => void };
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
}) {
  // Base UI resolves the displayed text from the selected *item*, so pass the option object
  // rather than the id — otherwise the closed control would show the raw id.
  // The object is kept stable by id and label: a refreshed `options` array holds new objects, and a new
  // selected object would make Base UI replace what the user is typing with the current label.
  const selectedLabel = options.find((option) => option.id === value)?.label;
  const selected = useMemo<ComboboxOption | null>(
    () => (selectedLabel === undefined ? null : { id: value, label: selectedLabel }),
    [value, selectedLabel],
  );

  const grouped = options.some((option) => option.group);
  const groups = useMemo(() => (grouped ? groupOptions(options) : []), [grouped, options]);

  const [searchQuery, setSearchQuery] = useState("");

  const renderItem = (option: ComboboxOption) => (
    <ComboboxItem key={option.id} value={option}>
      {/* Wraps instead of truncating: a long certificate name must not hide the kind at its end. */}
      <span className="min-w-0 flex-1 break-words">{option.label}</span>
      {option.hint ? (
        <span className="max-w-[40%] shrink-0 truncate text-caption text-muted-foreground">{option.hint}</span>
      ) : null}
    </ComboboxItem>
  );

  return (
    <Combobox<ComboboxOption>
      items={grouped ? groups : options}
      value={selected}
      onValueChange={(option) => onChange(option?.id ?? "")}
      onInputValueChange={(q) => setSearchQuery(q)}
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
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {emptyAction ? (
            <div className="flex flex-col items-center gap-1.5 py-1 text-center">
              <span>{emptyText}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-caption"
                onClick={() => emptyAction.onClick(searchQuery)}
              >
                + {emptyAction.label}
              </Button>
            </div>
          ) : (
            emptyText
          )}
        </ComboboxEmpty>
        <ComboboxList>
          {grouped
            ? (group: OptionGroup) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{group.value}</ComboboxLabel>
                  <ComboboxCollection>{renderItem}</ComboboxCollection>
                </ComboboxGroup>
              )
            : renderItem}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
