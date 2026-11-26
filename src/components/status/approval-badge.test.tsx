// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ApprovalBadge } from "@/components/status/record-status";

afterEach(cleanup);

describe("ApprovalBadge", () => {
  it("names Waiting, Approved and Returned in text", () => {
    render(
      <>
        <ApprovalBadge approval="waiting" />
        <ApprovalBadge approval="approved" />
        <ApprovalBadge approval="returned" />
      </>,
    );
    expect(screen.getByText("Waiting for approval")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("Returned")).toBeTruthy();
  });

  it("shows nothing when approval is null", () => {
    const { container } = render(<ApprovalBadge approval={null} />);
    expect(container.textContent).toBe("");
  });
});
