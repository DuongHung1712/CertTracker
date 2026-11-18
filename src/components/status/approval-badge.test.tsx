// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ApprovalBadge } from "@/components/status/record-status";

afterEach(cleanup);

describe("ApprovalBadge", () => {
  it("names Waiting and Returned in text", () => {
    render(<><ApprovalBadge approval="waiting" /><ApprovalBadge approval="returned" /></>);
    expect(screen.getByText("Waiting for approval")).toBeTruthy();
    expect(screen.getByText("Returned")).toBeTruthy();
  });

  it("shows nothing for Approved or no state", () => {
    const { container } = render(<><ApprovalBadge approval="approved" /><ApprovalBadge approval={null} /></>);
    expect(container.textContent).toBe("");
  });
});
