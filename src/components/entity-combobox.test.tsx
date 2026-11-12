// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EntityCombobox, type ComboboxOption } from "@/components/entity-combobox";

const OPTIONS: ComboboxOption[] = [
  { id: "a", label: "AWS Solutions Architect Associate · Exam" },
  { id: "n", label: "NVIDIA Generative AI LLMs · Exam" },
];

const field = (options: ComboboxOption[]) => (
  <EntityCombobox id="certificate" value="a" onChange={() => {}} options={options} placeholder="Choose" emptyText="None" />
);

afterEach(cleanup);

describe("EntityCombobox", () => {
  it("keeps the typed query when the page passes a fresh copy of the options", async () => {
    const { rerender } = render(field(OPTIONS));
    const input = screen.getByRole<HTMLInputElement>("combobox");
    await userEvent.clear(input);
    await userEvent.type(input, "nvidia");
    expect(input.value).toBe("nvidia");

    // A Realtime refresh re-renders the page with new option objects that hold the same data.
    rerender(field(OPTIONS.map((option) => ({ ...option }))));
    expect(input.value).toBe("nvidia");
  });

  it("shows the label of the selected option when closed", () => {
    render(field(OPTIONS));
    expect(screen.getByRole<HTMLInputElement>("combobox").value).toBe("AWS Solutions Architect Associate · Exam");
  });
});
