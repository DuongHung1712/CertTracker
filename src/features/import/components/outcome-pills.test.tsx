// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { OUTCOME_ALL, OutcomePills, type OutcomeFilter } from "@/features/import/components/outcome-pills";

const COUNTS = { create: 3, update: 0, unchanged: 2, error: 3 };

function Harness({ onValue }: { onValue?: (v: OutcomeFilter) => void }) {
  const [value, setValue] = useState<OutcomeFilter>(OUTCOME_ALL);
  return <OutcomePills counts={COUNTS} total={8} value={value} onChange={(v) => { setValue(v); onValue?.(v); }} />;
}

afterEach(cleanup);

describe("OutcomePills", () => {
  it("shows a count per pill, All pressed first, and disables an empty one", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "All 8" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Error 3" }).getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByRole("button", { name: "Update 0" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("selects a pill, and clicking it again goes back to All", async () => {
    const seen: OutcomeFilter[] = [];
    render(<Harness onValue={(v) => seen.push(v)} />);
    await userEvent.click(screen.getByRole("button", { name: "Error 3" }));
    expect(screen.getByRole("button", { name: "Error 3" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "All 8" }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "Error 3" }));
    expect(seen).toEqual(["error", "all"]);
  });

  it("is keyboard operable", async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("Create 3");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Create 3" }).getAttribute("aria-pressed")).toBe("true");
  });
});
