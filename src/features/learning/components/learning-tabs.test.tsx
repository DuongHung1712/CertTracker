// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningTabs } from "@/features/learning/components/learning-tabs";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/me", useSearchParams: () => new URLSearchParams("view=x") }));

afterEach(cleanup);

describe("LearningTabs", () => {
  it("shows both counts and switches panel, keeping other query params", async () => {
    render(<LearningTabs initialTab="certificates" certificatesCount={2} learningCount={5} certificates={<p>certs</p>} learning={<p>journey</p>} />);
    expect(screen.getByRole("tab", { name: "Certificates (2)" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("certs")).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Learning (5)" }));
    expect(screen.getByText("journey")).toBeTruthy();
    expect(replace).toHaveBeenCalledWith("/me?view=x&tab=learning", { scroll: false });
  });
});
