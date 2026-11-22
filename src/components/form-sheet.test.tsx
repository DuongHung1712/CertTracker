// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormSheet } from "@/components/form-sheet";

afterEach(cleanup);

function renderSheet(dirty: boolean, onOpenChange = vi.fn()) {
  render(
    <FormSheet open onOpenChange={onOpenChange} title="Add thing" onSubmit={(event) => event.preventDefault()} submitting={false} dirty={dirty}>
      <input aria-label="Name" />
    </FormSheet>,
  );
  return onOpenChange;
}

describe("FormSheet: unsaved input", () => {
  it("closes at once when nothing was entered", async () => {
    const onOpenChange = renderSheet(false);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Discard your changes?")).toBeNull();
  });

  it("asks first when the form is dirty; Keep editing leaves it open and Discard closes it", async () => {
    const onOpenChange = renderSheet(true);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard your changes?")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks on Esc too, not only on Cancel", async () => {
    const onOpenChange = renderSheet(true);
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByText("Discard your changes?")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
