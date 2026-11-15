// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

afterEach(cleanup);

describe("Field error wiring", () => {
  it("points an invalid input at its error and keeps an existing hint id", () => {
    render(
      <Field>
        <FieldLabel htmlFor="n">Name</FieldLabel>
        <Input id="n" aria-invalid aria-describedby="hint" />
        <FieldError errors={[{ message: "Name is required" }]} />
      </Field>,
    );
    const errorId = screen.getByRole("alert").id;
    expect(errorId).not.toBe("");
    expect(document.getElementById(errorId)?.textContent).toBe("Name is required");
    expect(screen.getByLabelText("Name").getAttribute("aria-describedby")).toBe(`hint ${errorId}`);
  });

  it("leaves aria-describedby alone while the control is valid", () => {
    render(
      <Field>
        <FieldLabel htmlFor="t">Notes</FieldLabel>
        <Textarea id="t" aria-describedby="hint" />
      </Field>,
    );
    expect(screen.getByLabelText("Notes").getAttribute("aria-describedby")).toBe("hint");
  });

  it("sets no aria-describedby at all without hint or error", () => {
    render(
      <Field>
        <FieldLabel htmlFor="p">Plain</FieldLabel>
        <Input id="p" />
      </Field>,
    );
    expect(screen.getByLabelText("Plain").hasAttribute("aria-describedby")).toBe(false);
  });

  it("gives each Field its own error id, and an explicit id wins", () => {
    render(
      <>
        <Field><FieldError errors={[{ message: "one" }]} /></Field>
        <Field><FieldError errors={[{ message: "two" }]} /></Field>
        <Field><FieldError id="custom">three</FieldError></Field>
      </>,
    );
    const [a, b, c] = screen.getAllByRole("alert");
    expect(a.id).not.toBe(b.id);
    expect(c.id).toBe("custom");
  });
});
