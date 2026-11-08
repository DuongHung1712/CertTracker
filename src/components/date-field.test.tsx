import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateField } from "@/components/date-field";

const noop = () => {};

function render(props: Partial<Parameters<typeof DateField>[0]> = {}): string {
  return renderToStaticMarkup(
    <DateField id="record-issued" label="Issue date" value="" onChange={noop} {...props} />,
  );
}

/** Opening tag of the first element matching `pattern`. */
function tag(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  expect(match, `no tag matching ${pattern}`).not.toBeNull();
  return match![0];
}

const textInput = (html: string) => tag(html, /<input(?![^>]*type="date")[^>]*>/);
const dateInput = (html: string) => tag(html, /<input[^>]*type="date"[^>]*>/);
const calendarButton = (html: string) => tag(html, /<button[^>]*>/);

describe("DateField", () => {
  it("associates the label with the text input", () => {
    const html = render();
    expect(tag(html, /<label[^>]*>/)).toContain('for="record-issued"');
    expect(html).toContain(">Issue date<");
    expect(textInput(html)).toContain('id="record-issued"');
  });

  it("renders a dd/mm/yyyy text input with a numeric keypad and 10-character limit", () => {
    const input = textInput(render());
    expect(input).toContain('placeholder="dd/mm/yyyy"');
    expect(input).toContain('inputMode="numeric"');
    expect(input).toContain('maxLength="10"');
  });

  it("names the calendar button after the label and keeps it focusable", () => {
    const button = calendarButton(render());
    expect(button).toContain('type="button"');
    expect(button).toContain('aria-label="Choose Issue date from calendar"');
    expect(button).not.toContain('tabindex="-1"');
    expect(button).not.toContain("disabled");
  });

  it("hides the native date input from assistive tech and the tab order", () => {
    const input = dateInput(render());
    expect(input).toContain('aria-hidden="true"');
    expect(input).toContain('tabindex="-1"');
  });

  it("passes max to the native date input only when given", () => {
    expect(dateInput(render({ max: "2026-11-08" }))).toContain('max="2026-11-08"');
    expect(dateInput(render({ label: "Planned exam date", id: "record-planned" }))).not.toContain("max=");
  });

  it("shows the current value in the text input", () => {
    expect(textInput(render({ value: "01/08/2026" }))).toContain('value="01/08/2026"');
  });
});
