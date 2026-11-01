import { beforeEach, describe, expect, it, vi } from "vitest";

const listRecords = vi.fn();
const listMemberCareers = vi.fn();
vi.mock("@/features/auth/queries", () => ({ getCurrentUser: async () => ({ id: "u1", role: "admin" }) }));
vi.mock("@/features/career/queries", () => ({ listMemberCareers: () => listMemberCareers() }));
vi.mock("@/features/records/queries", () => ({ listRecords: () => listRecords() }));

import { GET } from "@/app/api/export/records/route";

describe("GET /api/export/records", () => {
  beforeEach(() => {
    listRecords.mockReset();
    listMemberCareers.mockReset();
    listMemberCareers.mockResolvedValue(new Map());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("answers a generic English 500 when the records cannot be loaded completely", async () => {
    listRecords.mockRejectedValue(new Error("Query returned more than 20000 rows"));
    const response = await GET(new Request("http://localhost/api/export/records?format=csv"));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe("Could not export the data. Try again.");
    expect(text).not.toContain("20000");
  });

  it("answers 500 when the career profiles cannot be loaded, never a half-filled export", async () => {
    listRecords.mockResolvedValue([]);
    listMemberCareers.mockRejectedValue(new Error("boom"));
    const response = await GET(new Request("http://localhost/api/export/records?format=csv"));
    expect(response.status).toBe(500);
  });

  it("exports normally when loading succeeds", async () => {
    listRecords.mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/api/export/records?format=csv"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });
});
