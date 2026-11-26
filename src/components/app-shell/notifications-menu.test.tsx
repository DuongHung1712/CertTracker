// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { NotificationsMenu } from "@/components/app-shell/notifications-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

afterEach(cleanup);

describe("NotificationsMenu", () => {
  it("shows accurate coming-soon in-app alerts copy without contradicting live certificate approvals", async () => {
    render(
      <TooltipProvider>
        <NotificationsMenu />
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Notifications" });
    await userEvent.click(trigger);

    expect(await screen.findByText("In-app alerts")).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.getByText(/Expiry reminders and approval updates inside CertTracker\. Not available yet\./)).toBeTruthy();
    expect(screen.queryByText("Certificate review")).toBeNull();
  });
});
