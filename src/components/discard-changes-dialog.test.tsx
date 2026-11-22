// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";

afterEach(cleanup);

describe("DiscardChangesDialog", () => {
  it("asks first, and Keep editing leaves everything as it is", async () => {
    const onDiscard = vi.fn();
    const onOpenChange = vi.fn();
    render(<DiscardChangesDialog open onOpenChange={onOpenChange} onDiscard={onDiscard} />);
    expect(screen.getByText("Discard your changes?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("discards only when the member says so", async () => {
    const onDiscard = vi.fn();
    render(<DiscardChangesDialog open onOpenChange={() => {}} onDiscard={onDiscard} />);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
