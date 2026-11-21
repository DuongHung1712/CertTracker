import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

const { default: SkillsPage } = await import("./page");

describe("SkillsPage server component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated user to /login", async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    await expect(SkillsPage()).rejects.toThrow("redirect:/login");
  });

  it("redirects user without memberId to /dashboard", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-1",
      email: "admin@example.com",
      role: "admin",
      memberId: null,
    });

    await expect(SkillsPage()).rejects.toThrow("redirect:/dashboard");
  });

  it("renders page header and skills view for member", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-2",
      email: "member@example.com",
      role: "member",
      memberId: "m-123",
    });

    const jsx = await SkillsPage();
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain("My skills");
    expect(html).toContain("Rate each skill from 0 to 5");
    expect(html).toContain("The skills below are the ones this role uses.");
    expect(html).toContain("Senior Software Engineer");
  });
});
