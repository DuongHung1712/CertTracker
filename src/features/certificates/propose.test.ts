import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveCertificate, proposeCertificate } from "@/features/certificates/actions";
import { proposeCertificateSchema } from "@/features/certificates/schema";

const ID = "00000000-0000-0000-0000-000000000001";
const MEMBER_ID = "00000000-0000-0000-0000-0000000000m1";
const USER_ID = "00000000-0000-0000-0000-0000000000u1";

type Reply = { data: unknown; error: { code?: string; message: string } | null };

const replies: Record<string, Reply[]> = {};

function chain(table: string) {
  const self: Record<string, unknown> = {};
  const next = () => Promise.resolve(replies[table]?.shift() ?? { data: null, error: null });
  for (const method of ["select", "eq", "ilike", "in", "not", "neq", "limit", "delete", "update", "insert"]) {
    self[method] = () => self;
  }
  self.maybeSingle = next;
  self.single = next;
  self.then = (resolve: (reply: Reply) => unknown) => next().then(resolve);
  return self;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: chain,
    rpc: async (name: string) => replies[`rpc:${name}`]?.shift() ?? { data: null, error: null },
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID } } }),
    },
  }),
}));

beforeEach(() => {
  for (const key of Object.keys(replies)) delete replies[key];
});

describe("proposeCertificateSchema", () => {
  it("refuses a provider name in place of its id (the picker must send ids)", () => {
    const result = proposeCertificateSchema.safeParse({ name: "Agent skills", kind: "exam", providerId: "AWS" });
    expect(result.success).toBe(false);
  });

  it("validates that either providerId or proposedProvider is supplied", () => {
    const validWithId = proposeCertificateSchema.safeParse({
      name: "Google Cloud Leader",
      kind: "exam",
      providerId: ID,
    });
    expect(validWithId.success).toBe(true);

    const validWithName = proposeCertificateSchema.safeParse({
      name: "Google Cloud Leader",
      kind: "exam",
      proposedProvider: "Google Cloud",
    });
    expect(validWithName.success).toBe(true);

    const invalidNoProvider = proposeCertificateSchema.safeParse({
      name: "Google Cloud Leader",
      kind: "exam",
      providerId: null,
      proposedProvider: "",
    });
    expect(invalidNoProvider.success).toBe(false);
  });

  it("validates optional url format when provided", () => {
    const invalidUrl = proposeCertificateSchema.safeParse({
      name: "Test Cert",
      kind: "exam",
      providerId: ID,
      url: "not-a-url",
    });
    expect(invalidUrl.success).toBe(false);

    const emptyUrl = proposeCertificateSchema.safeParse({
      name: "Test Cert",
      kind: "exam",
      providerId: ID,
      url: "",
    });
    expect(emptyUrl.success).toBe(true);

    const whitespaceUrl = proposeCertificateSchema.safeParse({
      name: "Test Cert",
      kind: "exam",
      providerId: ID,
      url: "   ",
    });
    expect(whitespaceUrl.success).toBe(true);
    if (whitespaceUrl.success) {
      expect(whitespaceUrl.data.url).toBeNull();
    }
  });

  it("converts whitespace-only reason to null", () => {
    const parsed = proposeCertificateSchema.safeParse({
      name: "Test Cert",
      kind: "exam",
      providerId: ID,
      reason: "   ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reason).toBeNull();
    }
  });
});

describe("proposeCertificate action", () => {
  it("creates a pending certificate with catalogue_status = 'pending'", async () => {
    // 1. profiles lookup
    replies.profiles = [{ data: { member_id: MEMBER_ID, role: "member" }, error: null }];
    // 2. existing check
    replies.certificates = [
      { data: [], error: null }, // no existing duplicate
      {
        data: {
          id: ID,
          name: "Kubernetes CKA",
          kind: "exam",
          provider_id: ID,
          proposed_provider: null,
          catalogue_status: "pending",
          providers: { name: "CNCF" },
        },
        error: null,
      }, // insert result
    ];

    const result = await proposeCertificate({
      name: "Kubernetes CKA",
      kind: "exam",
      providerId: ID,
      reason: "Required for cloud migration",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(ID);
      expect(result.data.label).toBe("Kubernetes CKA");
      expect(result.data.catalogueStatus).toBe("pending");
    }
  });

  it("rejects proposal if an approved certificate already exists with the same name", async () => {
    replies.profiles = [{ data: { member_id: MEMBER_ID, role: "member" }, error: null }];
    replies.certificates = [
      { data: { id: "existing-1", name: "AWS SAA", kind: "exam", catalogue_status: "approved" }, error: null },
    ];

    const result = await proposeCertificate({
      name: "AWS SAA",
      kind: "exam",
      providerId: ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already in the Catalogue");
    }
  });

  it("handles duplicate unique constraint gracefully from database", async () => {
    replies.profiles = [{ data: { member_id: MEMBER_ID, role: "member" }, error: null }];
    replies.certificates = [
      { data: [], error: null }, // no existing check match
      { data: null, error: { code: "23505", message: "duplicate key" } }, // db duplicate constraint
    ];

    const result = await proposeCertificate({
      name: "Duplicate Cert",
      kind: "exam",
      providerId: ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already exists");
    }
  });
});

describe("approveCertificate action", () => {
  it("approves through the approve_certificate function", async () => {
    replies["rpc:approve_certificate"] = [{ data: null, error: null }];
    expect(await approveCertificate({ id: ID })).toEqual({ ok: true, data: null });
  });

  it("says when the proposal was already reviewed", async () => {
    replies["rpc:approve_certificate"] = [{ data: null, error: { code: "P0002", message: "proposal not found" } }];
    const result = await approveCertificate({ id: ID });
    expect(result).toEqual({ ok: false, error: "This proposal was already reviewed. Refresh the page." });
  });
});
