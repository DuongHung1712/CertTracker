// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ComplianceCopilotWidget } from "@/features/dashboard/components/member/compliance-copilot-widget";

afterEach(cleanup);

describe("ComplianceCopilotWidget", () => {
  it("is named by its visible text and opens a Coming soon panel whose question box is disabled", async () => {
    render(<ComplianceCopilotWidget />);
    const toggle = screen.getByRole("button", { name: "Ask about certificates" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", { name: "Ask about certificates (Coming soon)" });
    expect(panel.textContent).toContain("Not available yet.");
    const box = screen.getByRole("textbox", { name: "Your question" }) as HTMLInputElement;
    expect(box.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Send question" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
