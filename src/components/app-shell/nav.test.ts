import { describe, expect, it } from "vitest";
import { isActivePath, labelForPath, navForUser } from "@/components/app-shell/nav";

const hrefs = (role: "admin" | "manager" | "member", hasMember: boolean) =>
  navForUser(role, hasMember).map((item) => item.href);

describe("navForUser (docs/design-system.md §4.5)", () => {
  it("gives admins everything; 'my certificates' only when linked to a member", () => {
    expect(hrefs("admin", false)).toEqual([
      "/dashboard",
      "/members",
      "/records",
      "/data-quality",
      "/courses",
      "/org",
      "/import",
      "/settings",
    ]);
    expect(hrefs("admin", true)).toContain("/me");
  });

  it("gives managers team views but no org, import or settings", () => {
    expect(hrefs("manager", true)).toEqual(["/dashboard", "/me", "/members", "/records", "/data-quality", "/courses"]);
  });

  it("gives members only their own views and the catalogue", () => {
    expect(hrefs("member", true)).toEqual(["/dashboard", "/me", "/courses"]);
  });
});

describe("isActivePath", () => {
  it("matches the item and its sub-pages only", () => {
    expect(isActivePath("/members", "/members")).toBe(true);
    expect(isActivePath("/members/42", "/members")).toBe(true);
    expect(isActivePath("/members-archive", "/members")).toBe(false);
  });
});

describe("labelForPath", () => {
  it("names the current section", () => {
    expect(labelForPath("/members/42")).toBe("Thành viên");
    expect(labelForPath("/data-quality")).toBe("Chất lượng dữ liệu");
    expect(labelForPath("/unknown")).toBe("CertTracker");
  });
});
