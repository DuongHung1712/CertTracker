import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCron, type CronJob, type HandlerDeps } from "@/features/notifications/handler";
import type { RunSummary } from "@/features/notifications/run";
import { FakeLedger, FakeSender } from "@/features/notifications/test-doubles";
import type { Snapshot } from "@/features/notifications/types";
import { EmailConfigError } from "@/lib/email/sender";
import type { Database } from "@/types/database";

const SECRET = "0123456789abcdef-secret";
const NOON_OCT_5 = Date.parse("2026-10-05T05:00:00Z");

const snapshot: Snapshot = {
  members: [
    { id: "a", code: "A", fullName: "Member a", email: "a@x.test", teamId: "t1", isActive: true },
  ],
  teams: [{ id: "t1", name: "Cloud" }],
  staff: [
    { userId: "adm", email: "adm@x.test", role: "admin", memberId: null, teamIds: [] },
    { userId: "boss", email: "boss@x.test", role: "manager", memberId: null, teamIds: ["t1"] },
  ],
  records: [
    {
      id: "r1",
      memberId: "a",
      status: "done",
      courseName: "AWS",
      issuedDate: "2026-01-01",
      expiryDate: "2026-10-20",
      daysToExpiry: 15,
      expiryStatus: "Expiring Soon",
    },
  ],
};

const request = (query = "", headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }, job: CronJob = "expiry-alerts") =>
  new Request(`http://x/api/cron/${job}${query}`, { headers });

function setup(over: Partial<HandlerDeps> = {}) {
  const ledger = new FakeLedger();
  const sender = new FakeSender("console");
  const calls = { createClient: 0, loadSnapshot: 0, createLedger: 0, createSender: 0 };
  const deps: HandlerDeps = {
    env: { CRON_SECRET: SECRET, APP_URL: "https://app.example.test/" },
    now: () => NOON_OCT_5,
    createClient: () => {
      calls.createClient += 1;
      return {} as unknown as SupabaseClient<Database>;
    },
    loadSnapshot: async () => {
      calls.loadSnapshot += 1;
      return snapshot;
    },
    createLedger: () => {
      calls.createLedger += 1;
      return ledger;
    },
    createSender: () => {
      calls.createSender += 1;
      return sender;
    },
    ...over,
  };
  return { deps, ledger, sender, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("handleCron authentication", () => {
  it("answers 401 without touching Supabase when there is no Authorization header (edge #56)", async () => {
    const { deps, calls, ledger, sender } = setup();
    const res = await handleCron(request("", {}), "expiry-alerts", deps);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(calls).toEqual({ createClient: 0, loadSnapshot: 0, createLedger: 0, createSender: 0 });
    expect(ledger.calls.claim).toBe(0);
    expect(sender.sent).toHaveLength(0);
  });

  it("answers 401 for a wrong token and does not touch Supabase", async () => {
    const { deps, calls } = setup();
    const res = await handleCron(request("", { authorization: "Bearer not-the-right-secret" }), "expiry-alerts", deps);
    expect(res.status).toBe(401);
    expect(calls.createClient).toBe(0);
  });

  it("fails closed with 500 when CRON_SECRET is missing, even for a request with a bearer token (edge #54)", async () => {
    const { deps, calls } = setup({ env: {} });
    const res = await handleCron(request("", { authorization: "Bearer anything-at-all-123" }), "expiry-alerts", deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "cron-not-configured" });
    expect(calls.createClient).toBe(0);
    expect(calls.createSender).toBe(0);
  });

  it("fails closed when CRON_SECRET is too short", async () => {
    const { deps, calls } = setup({ env: { CRON_SECRET: "short" } });
    const res = await handleCron(request("", { authorization: "Bearer short" }), "expiry-alerts", deps);
    expect(res.status).toBe(500);
    expect(calls.createClient).toBe(0);
  });
});

describe("handleCron runs", () => {
  it("returns the summary of a dry run and sends/writes nothing (edge #50)", async () => {
    const { deps, calls, ledger, sender } = setup();
    const res = await handleCron(request("?dryRun=1"), "expiry-alerts", deps);
    expect(res.status).toBe(200);
    const body = (await res.json()) as RunSummary;
    expect(body).toMatchObject({ job: "expiry-alert", period: "2026-W41", dryRun: true, transport: "console", planned: 2, sent: 0 });
    expect(body.recipients?.map((r) => r.email)).toEqual(["a@x.test", "boss@x.test"]);
    expect(calls.createSender).toBe(1);
    expect(ledger.calls).toEqual({ claim: 0, markSent: 0, markFailed: 0 });
    expect(sender.sent).toHaveLength(0);
  });

  it("only treats dryRun=1 as a dry run", async () => {
    const { deps, sender } = setup();
    const res = await handleCron(request("?dryRun=0"), "expiry-alerts", deps);
    expect(((await res.json()) as RunSummary).dryRun).toBe(false);
    expect(sender.sent).toHaveLength(2);
  });

  it("sends for real and answers 200 when nobody failed, then skips on the second call (edge #9)", async () => {
    const { deps, sender } = setup();
    const first = await handleCron(request(), "expiry-alerts", deps);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ sent: 2, skipped: 0, failed: 0 });
    expect(sender.sent).toHaveLength(2);
    expect(sender.sent[0].html).toContain("https://app.example.test"); // trailing slash trimmed, link rendered

    const second = await handleCron(request(), "expiry-alerts", deps);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ sent: 0, skipped: 2 });
    expect(sender.sent).toHaveLength(2);
  });

  it("answers 500 with the whole summary when any recipient failed (edge #45)", async () => {
    const { deps, sender } = setup();
    sender.outcome = (to) => (to === "a@x.test" ? { ok: false, error: "provider 500" } : { ok: true, providerId: null });
    const res = await handleCron(request(), "expiry-alerts", deps);
    expect(res.status).toBe(500);
    const body = (await res.json()) as RunSummary;
    expect(body).toMatchObject({ sent: 1, failed: 1, failures: [{ email: "a@x.test", error: "provider 500" }] });
  });

  it("answers 200 with truncated: true when the deadline stops the batch (edge #49)", async () => {
    let clock = NOON_OCT_5;
    const { deps, sender } = setup({
      now: () => {
        const t = clock;
        clock += 30_000;
        return t;
      },
    });
    const res = await handleCron(request(), "expiry-alerts", deps);
    expect(res.status).toBe(200);
    const body = (await res.json()) as RunSummary;
    expect(body.truncated).toBe(true);
    expect(body.sent).toBeLessThan(body.planned);
    expect(sender.sent.length).toBe(body.sent);
  });

  it("computes the period from the Vietnam date of now(): 18:00Z on 30 Sep reports September (edge #8)", async () => {
    const { deps } = setup({ now: () => Date.parse("2026-09-30T18:00:00Z") });
    const res = await handleCron(request("?dryRun=1", undefined, "monthly-report"), "monthly-report", deps);
    expect(await res.json()).toMatchObject({ job: "monthly-report", period: "2026-09", dryRun: true });
  });

  it("runs the monthly job for real with the month subject", async () => {
    const { deps, sender } = setup({ now: () => Date.parse("2026-10-01T02:00:00Z") });
    const res = await handleCron(request("", undefined, "monthly-report"), "monthly-report", deps);
    expect(res.status).toBe(200);
    expect(((await res.json()) as RunSummary).planned).toBe(2);
    expect(sender.sent.every((m) => m.subject.includes("tháng 09/2026"))).toBe(true);
  });

  it("omits the app link when APP_URL is not set", async () => {
    const { deps, sender } = setup({ env: { CRON_SECRET: SECRET } });
    await handleCron(request(), "expiry-alerts", deps);
    expect(sender.sent[0].html).not.toContain("https://app.example.test");
  });
});

describe("handleCron failure handling", () => {
  it("answers 500 email-not-configured before any claim, even for a dry run (edge #57)", async () => {
    for (const query of ["", "?dryRun=1"]) {
      const { deps, ledger, calls } = setup({
        createSender: () => {
          throw new EmailConfigError("RESEND_API_KEY is not set.");
        },
      });
      const res = await handleCron(request(query), "expiry-alerts", deps);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "email-not-configured", detail: "RESEND_API_KEY is not set." });
      expect(ledger.calls.claim).toBe(0);
      expect(calls.createClient).toBe(0);
      expect(calls.loadSnapshot).toBe(0);
    }
  });

  it("does not leak internals when the sender cannot be created for another reason", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = setup({
      createSender: () => {
        throw new Error("secret-internal-detail");
      },
    });
    const res = await handleCron(request(), "expiry-alerts", deps);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret-internal-detail");
    expect(log).toHaveBeenCalled();
  });

  it("answers a generic 500 and logs server-side when loading the snapshot throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, ledger } = setup({
      loadSnapshot: async () => {
        throw new Error("connection string postgres://user:pw@host leaked?");
      },
    });
    const res = await handleCron(request(), "expiry-alerts", deps);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "internal" });
    expect(text).not.toContain("postgres://");
    expect(text).not.toContain("stack");
    expect(log).toHaveBeenCalled();
    expect(ledger.calls.claim).toBe(0);
  });

  it("answers a generic 500 when creating the admin client throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = setup({
      createClient: () => {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
      },
    });
    const res = await handleCron(request(), "expiry-alerts", deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal" });
  });

  it("answers 404 for an unknown job, after authentication", async () => {
    const { deps, calls } = setup();
    const res = await handleCron(request(), "nope" as CronJob, deps);
    expect(res.status).toBe(404);
    expect(calls.createClient).toBe(0);
    const unauthenticated = await handleCron(request("", {}), "nope" as CronJob, deps);
    expect(unauthenticated.status).toBe(401);
  });
});
