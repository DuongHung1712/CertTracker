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

  it("lists grouped options under their headings and still filters across groups", async () => {
    const grouped: ComboboxOption[] = [
      { id: "a", label: "AWS Associate", group: "Exam certificates" },
      { id: "c", label: "Intro to LLMs", group: "Course completions" },
      { id: "n", label: "NVIDIA Associate", group: "Exam certificates" },
    ];
    render(
      <EntityCombobox id="certificate" value="" onChange={() => {}} options={grouped} placeholder="Choose" emptyText="None" />,
    );
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    expect(screen.getByText("Exam certificates")).toBeTruthy();
    expect(screen.getByText("Course completions")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(3);

    await userEvent.type(input, "llms");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Intro to LLMs"]);
    expect(screen.queryByText("Exam certificates")).toBeNull();
  });
});
