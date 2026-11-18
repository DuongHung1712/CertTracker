// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button component", () => {
  afterEach(cleanup);

  it("renders with default slot, variant and size attributes", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn.getAttribute("data-slot")).toBe("button");
    expect(btn.getAttribute("data-variant")).toBe("default");
    expect(btn.getAttribute("data-size")).toBe("default");
  });

  it("supports custom variant and size attributes for vault theme targeting", () => {
    render(
      <Button variant="secondary" size="sm">
        Secondary Small
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Secondary Small" });
    expect(btn.getAttribute("data-variant")).toBe("secondary");
    expect(btn.getAttribute("data-size")).toBe("sm");
  });

  it("supports destructive and outline variants", () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("destructive");

    rerender(<Button variant="outline">Cancel</Button>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("outline");
  });
});
