import { beforeEach, describe, expect, it, vi } from "vitest";

const listRecords = vi.fn();
vi.mock("@/features/auth/queries", () => ({ getCurrentUser: async () => ({ id: "u1", role: "admin" }) }));
vi.mock("@/features/records/queries", () => ({ listRecords: () => listRecords() }));

import { GET } from "@/app/api/export/records/route";

describe("GET /api/export/records", () => {
  beforeEach(() => {
    listRecords.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("answers a generic Vietnamese 500 when the records cannot be loaded completely", async () => {
    listRecords.mockRejectedValue(new Error("Query returned more than 20000 rows"));
    const response = await GET(new Request("http://localhost/api/export/records?format=csv"));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe("Không xuất được dữ liệu. Vui lòng thử lại.");
    expect(text).not.toContain("20000");
  });

  it("exports normally when loading succeeds", async () => {
    listRecords.mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/api/export/records?format=csv"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });
});
