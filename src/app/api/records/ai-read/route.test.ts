import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getCurrentUser = vi.fn();
vi.mock("@/features/auth/queries", () => ({ getCurrentUser: () => getCurrentUser() }));
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));
const listCertificates = vi.fn();
vi.mock("@/features/certificates/queries", () => ({ listCertificates: () => listCertificates() }));
const claim = vi.fn();
const finish = vi.fn(async () => undefined);
vi.mock("@/lib/ai/usage-store", () => ({ createUsageStore: () => ({ isEnabled: async () => true, claim, finish }) }));

import { POST } from "@/app/api/records/ai-read/route";

const CERT_ID = "38e00000-0000-0000-0000-000000000001";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

const post = (file: File | null, headers: Record<string, string> = {}) => {
  const form = new FormData();
  if (file) form.set("file", file);
  return new Request("http://localhost/api/records/ai-read", { method: "POST", body: form, headers });
};

beforeEach(() => {
  getCurrentUser.mockReset().mockResolvedValue({ id: "11111111-2222-3333-4444-555555555555", email: "a@b.c", role: "member", memberId: "m-1" });
  maybeSingle.mockReset().mockResolvedValue({ data: { code: "M001" }, error: null });
  listCertificates.mockReset().mockResolvedValue([
    { id: CERT_ID, name: "AWS SAA", kind: "exam", providerName: "AWS", catalogueStatus: "approved" },
    { id: "38e00000-0000-0000-0000-000000000009", name: "Pending one", kind: "exam", providerName: "X", catalogueStatus: "pending" },
  ]);
  claim.mockReset().mockResolvedValue({ ok: true, usageId: "u-1" });
  finish.mockClear();
  vi.stubEnv("AI_TRANSPORT", "");
});

describe("POST /api/records/ai-read", () => {
  it("answers 401 when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await POST(post(new File([PNG], "a.png")))).status).toBe(401);
  });
  it("answers 413 for a declared body over 4 MB before reading it", async () => {
    const response = await POST(post(new File([PNG], "a.png"), { "content-length": String(10 * 1024 * 1024) }));
    expect(response.status).toBe(413);
  });
  it("answers 400 when no file is sent", async () => {
    expect((await POST(post(null))).status).toBe(400);
  });
  it("answers 422 with the message for a file that is not an image", async () => {
    const response = await POST(post(new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" })));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/PDF, JPG, PNG or WebP/);
    expect(claim).not.toHaveBeenCalled();
  });
  it("returns the suggestion from the fake gateway, keyed to the signed-in member code and only the approved catalogue", async () => {
    const response = await POST(post(new File([PNG], "cert.png", { type: "image/png" })));
    expect(response.status).toBe(200);
    expect((await response.json()).suggestion).toMatchObject({ kind: "exam", certificateId: CERT_ID, issuedDate: "2026-03-14" });
    expect(claim).toHaveBeenCalledWith("certificate-reader", "M001");
  });
  it("uses a pseudonym from the user id for an admin with no member row", async () => {
    getCurrentUser.mockResolvedValue({ id: "abcdef12-0000-0000-0000-000000000000", email: "x@y.z", role: "admin", memberId: null });
    await POST(post(new File([PNG], "cert.png", { type: "image/png" })));
    expect(claim).toHaveBeenCalledWith("certificate-reader", "U-abcdef12");
  });
  it("says AI is not available, not a server error, when the gateway is misconfigured", async () => {
    vi.stubEnv("AI_TRANSPORT", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const response = await POST(post(new File([PNG], "cert.png", { type: "image/png" })));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/not available/i);
    expect(claim).not.toHaveBeenCalled();
  });
  it("answers a corrupt PDF with a plain message and still counts the claimed call as unreadable", async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2])], "a.pdf", { type: "application/pdf" });
    const response = await POST(post(pdf));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("That PDF could not be read.");
    expect(finish).toHaveBeenCalledWith("u-1", expect.objectContaining({ outcome: "unreadable" }));
  }, 30_000);
});
