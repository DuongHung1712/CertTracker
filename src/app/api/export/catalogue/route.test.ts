import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/features/auth/queries", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/features/certificates/queries", () => ({ listCertificates: async () => [] }));
vi.mock("@/features/courses/queries", () => ({ listCourses: async () => [] }));

import { GET } from "@/app/api/export/catalogue/route";

const call = (format = "csv") => GET(new Request(`http://localhost/api/export/catalogue?format=${format}`));

describe("GET /api/export/catalogue", () => {
  beforeEach(() => getCurrentUser.mockReset());

  it("refuses a bad format, anonymous visitors and non-admins", async () => {
    expect((await call("pdf")).status).toBe(400);
    getCurrentUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    getCurrentUser.mockResolvedValue({ id: "u", role: "manager" });
    expect((await call()).status).toBe(403);
    getCurrentUser.mockResolvedValue({ id: "u", role: "member" });
    expect((await call("xlsx")).status).toBe(403);
  });

  it("serves a CSV to an admin", async () => {
    getCurrentUser.mockResolvedValue({ id: "u", role: "admin" });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });
});
