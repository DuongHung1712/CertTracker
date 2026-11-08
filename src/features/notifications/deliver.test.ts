import { describe, expect, it } from "vitest";
import { deliver, type Outbound } from "@/features/notifications/deliver";
import { FakeLedger, FakeSender } from "@/features/notifications/test-doubles";

const PERIOD = "2026-W41";
const outbound = (...emails: string[]): Outbound[] =>
  emails.map((email) => ({
    email,
    detail: { own: 1 },
    render: async () => ({ subject: `Subject for ${email}`, html: "<p>x</p>", text: "x" }),
  }));

const setup = () => ({ ledger: new FakeLedger(), sender: new FakeSender() });
const base = { kind: "expiry-alert" as const, period: PERIOD, dryRun: false, now: () => 0, deadlineMs: Number.MAX_SAFE_INTEGER };

describe("deliver", () => {
  it("sends every recipient once with a per-recipient idempotency key and records each as sent", async () => {
    const { ledger, sender } = setup();
    const result = await deliver({ ...base, outbound: outbound("a@x.test", "b@x.test", "c@x.test"), ledger, sender });
    expect(result).toMatchObject({ planned: 3, sent: 3, skipped: 0, failed: 0, truncated: false });
    expect(sender.sent.map((m) => m.idempotencyKey)).toEqual([
      "expiry-alert:2026-W41:a@x.test",
      "expiry-alert:2026-W41:b@x.test",
      "expiry-alert:2026-W41:c@x.test",
    ]);
    expect(sender.sent.map((m) => m.to)).toEqual(["a@x.test", "b@x.test", "c@x.test"]);
    expect(sender.sent[0].subject).toBe("Subject for a@x.test");
    expect(ledger.calls.markSent).toBe(3);
    expect(ledger.all.every((r) => r.status === "sent" && r.providerId === "prov-1")).toBe(true);
  });

  it("skips everyone on a second call for the same period (edge #9)", async () => {
    const { ledger, sender } = setup();
    const list = outbound("a@x.test", "b@x.test", "c@x.test");
    await deliver({ ...base, outbound: list, ledger, sender });
    sender.sent = [];
    const second = await deliver({ ...base, outbound: list, ledger, sender });
    expect(second).toMatchObject({ planned: 3, sent: 0, skipped: 3, failed: 0 });
    expect(sender.sent).toHaveLength(0);
  });

  it("counts a claim held by another run as in-flight, not skipped, and warns about it", async () => {
    const { ledger, sender } = setup();
    ledger.seedPending("expiry-alert", PERIOD, "a@x.test");
    const result = await deliver({ ...base, outbound: outbound("a@x.test", "b@x.test"), ledger, sender });
    expect(result).toMatchObject({ planned: 2, sent: 1, skipped: 0, inFlight: 1, failed: 0 });
    expect(result.warnings).toEqual(["a@x.test: another run holds the claim; re-run after ~15 minutes if it does not finish"]);
    expect(sender.sent.map((m) => m.to)).toEqual(["b@x.test"]);
    expect(ledger.rows.get(`expiry-alert|${PERIOD}|a@x.test`)?.status).toBe("pending");
  });

  it("keeps skipped for already-sent recipients only", async () => {
    const { ledger, sender } = setup();
    const list = outbound("a@x.test", "b@x.test");
    await deliver({ ...base, outbound: list.slice(0, 1), ledger, sender });
    ledger.seedPending("expiry-alert", PERIOD, "b@x.test");
    const result = await deliver({ ...base, outbound: list, ledger, sender });
    expect(result).toMatchObject({ sent: 0, skipped: 1, inFlight: 1 });
  });

  it("reclaims a pending row once it is older than 15 minutes", async () => {
    const { ledger, sender } = setup();
    ledger.seedPending("expiry-alert", PERIOD, "a@x.test");
    ledger.advance(15 * 60_000 + 1);
    const result = await deliver({ ...base, outbound: outbound("a@x.test"), ledger, sender });
    expect(result).toMatchObject({ sent: 1, inFlight: 0 });
    expect(ledger.rows.get(`expiry-alert|${PERIOD}|a@x.test`)).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("re-claims a failed recipient on the next call and skips the one already sent (decisions #36)", async () => {
    const { ledger, sender } = setup();
    const list = outbound("a@x.test", "b@x.test");
    sender.outcome = (to) => (to === "b@x.test" ? { ok: false, error: "provider 500" } : { ok: true, providerId: "p" });
    const first = await deliver({ ...base, outbound: list, ledger, sender });
    expect(first).toMatchObject({ sent: 1, failed: 1 });
    expect(ledger.rows.get(`expiry-alert|${PERIOD}|b@x.test`)?.status).toBe("failed");

    sender.sent = [];
    sender.outcome = () => ({ ok: true, providerId: "p2" });
    const second = await deliver({ ...base, outbound: list, ledger, sender });
    expect(second).toMatchObject({ sent: 1, skipped: 1, inFlight: 0, failed: 0 });
    expect(sender.sent.map((m) => m.to)).toEqual(["b@x.test"]);
    expect(ledger.rows.get(`expiry-alert|${PERIOD}|b@x.test`)).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("retries markSent once before calling a sent mail unrecorded", async () => {
    const { ledger, sender } = setup();
    ledger.markSentThrowsFor.set("a@x.test", 1);
    const result = await deliver({ ...base, outbound: outbound("a@x.test"), ledger, sender });
    expect(result).toMatchObject({ sent: 1, failed: 0 });
    expect(result.warnings).toEqual([]);
    expect(ledger.calls.markSent).toBe(2);
    expect(ledger.rows.get(`expiry-alert|${PERIOD}|a@x.test`)?.status).toBe("sent");
  });

  it("gives up after the single retry and mentions the idempotency window", async () => {
    const { ledger, sender } = setup();
    ledger.markSentThrowsFor.set("a@x.test", 2);
    const result = await deliver({ ...base, outbound: outbound("a@x.test"), ledger, sender });
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(ledger.calls.markSent).toBe(2);
    expect(result.failures[0].error).toContain("sent but could not be recorded");
    expect(result.failures[0].error).toContain("24 h");
  });

  describe("accounting: planned = sent + skipped + inFlight + failed + unreached", () => {
    const total = (r: { sent: number; skipped: number; inFlight: number; failed: number }) => r.sent + r.skipped + r.inFlight + r.failed;

    it("holds in the normal case", async () => {
      const { ledger, sender } = setup();
      const list = outbound("a@x.test", "b@x.test", "c@x.test", "d@x.test");
      await deliver({ ...base, outbound: list.slice(0, 1), ledger, sender }); // a already sent
      ledger.seedPending("expiry-alert", PERIOD, "b@x.test"); // b in flight
      const r = await deliver({ ...base, outbound: list, ledger, sender });
      expect(r).toMatchObject({ planned: 4, sent: 2, skipped: 1, inFlight: 1, failed: 0, truncated: false });
      expect(total(r)).toBe(r.planned);
    });

    it("holds when some recipients fail", async () => {
      const { ledger, sender } = setup();
      ledger.claimThrowsFor.add("a@x.test");
      sender.outcome = (to) => (to === "b@x.test" ? { ok: false, error: "x" } : { ok: true, providerId: null });
      const r = await deliver({ ...base, outbound: outbound("a@x.test", "b@x.test", "c@x.test"), ledger, sender });
      expect(r).toMatchObject({ planned: 3, sent: 1, failed: 2 });
      expect(total(r)).toBe(r.planned);
    });

    it("holds when truncated: the remainder is exactly the recipients never claimed", async () => {
      const { ledger, sender } = setup();
      ledger.seedPending("expiry-alert", PERIOD, "a@x.test");
      let clock = 0;
      const now = () => {
        const t = clock;
        clock += 10_000;
        return t;
      };
      const list = outbound("a@x.test", "b@x.test", "c@x.test", "d@x.test", "e@x.test");
      const r = await deliver({ ...base, now, deadlineMs: 30_000, outbound: list, ledger, sender });
      expect(r).toMatchObject({ planned: 5, inFlight: 1, sent: 2, truncated: true });
      expect(r.planned - total(r)).toBe(2);
      expect(r.planned - total(r)).toBe(list.length - ledger.calls.claim);
    });
  });

  it("counts a send failure, records it and still delivers to the next recipient (edge #45)", async () => {
    const { ledger, sender } = setup();
    sender.outcome = (to) => (to === "b@x.test" ? { ok: false, error: "provider 500" } : { ok: true, providerId: null });
    const result = await deliver({ ...base, outbound: outbound("a@x.test", "b@x.test", "c@x.test"), ledger, sender });
    expect(result).toMatchObject({ sent: 2, failed: 1 });
    expect(result.failures).toEqual([{ email: "b@x.test", error: "provider 500" }]);
    expect(sender.sent.map((m) => m.to)).toContain("c@x.test");
    expect(ledger.calls.markFailed).toBe(1);
    expect(ledger.all.find((r) => r.email === "b@x.test")).toMatchObject({ status: "failed", error: "provider 500" });
  });

  it("treats a render error as a failed send and keeps going", async () => {
    const { ledger, sender } = setup();
    const list = outbound("a@x.test", "b@x.test");
    list[0].render = async () => {
      throw new Error("template exploded");
    };
    const result = await deliver({ ...base, outbound: list, ledger, sender });
    expect(result).toMatchObject({ sent: 1, failed: 1 });
    expect(result.failures[0]).toEqual({ email: "a@x.test", error: "template exploded" });
    expect(ledger.calls.markFailed).toBe(1);
    expect(sender.sent.map((m) => m.to)).toEqual(["b@x.test"]);
  });

  it("counts a claim error as failed without a log row to mark, and continues (edge #46)", async () => {
    const { ledger, sender } = setup();
    ledger.claimThrowsFor.add("a@x.test");
    const result = await deliver({ ...base, outbound: outbound("a@x.test", "b@x.test"), ledger, sender });
    expect(result).toMatchObject({ sent: 1, failed: 1 });
    expect(result.failures[0].email).toBe("a@x.test");
    expect(result.failures[0].error).toContain("db down");
    expect(ledger.calls.markFailed).toBe(0);
    expect(sender.sent.map((m) => m.to)).toEqual(["b@x.test"]);
  });

  it("reports a send that could not be recorded as failed (edge #47)", async () => {
    const { ledger, sender } = setup();
    ledger.markSentThrowsFor.set("a@x.test", Infinity);
    const result = await deliver({ ...base, outbound: outbound("a@x.test", "b@x.test"), ledger, sender });
    expect(sender.sent.map((m) => m.to)).toEqual(["a@x.test", "b@x.test"]);
    expect(result).toMatchObject({ sent: 1, failed: 1 });
    expect(result.failures[0].error).toContain("sent but could not be recorded");
  });

  it("still counts sent but warns when the claim was lost, without double counting (edge #48)", async () => {
    const { ledger, sender } = setup();
    ledger.markSentLostFor.add("a@x.test");
    const result = await deliver({ ...base, outbound: outbound("a@x.test"), ledger, sender });
    expect(result).toMatchObject({ planned: 1, sent: 1, skipped: 0, failed: 0 });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("claim lost");
  });

  it("warns when a failure could not be recorded, but still counts the failure once", async () => {
    const { ledger, sender } = setup();
    sender.outcome = () => ({ ok: false, error: "boom" });
    ledger.markFailedThrows = true;
    const result = await deliver({ ...base, outbound: outbound("a@x.test"), ledger, sender });
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(result.warnings[0]).toContain("could not record the failure");
  });

  it("does nothing but list the recipients in a dry run (edge #50)", async () => {
    const { ledger, sender } = setup();
    const result = await deliver({ ...base, dryRun: true, outbound: outbound("a@x.test", "b@x.test"), ledger, sender });
    expect(result).toMatchObject({ planned: 2, sent: 0, skipped: 0, failed: 0, truncated: false });
    expect(result.recipients).toEqual([
      { email: "a@x.test", detail: { own: 1 } },
      { email: "b@x.test", detail: { own: 1 } },
    ]);
    expect(ledger.calls).toEqual({ claim: 0, markSent: 0, markFailed: 0 });
    expect(ledger.all).toHaveLength(0);
    expect(sender.sent).toHaveLength(0);
  });

  it("does not render in a dry run", async () => {
    const { ledger, sender } = setup();
    let rendered = 0;
    const list = outbound("a@x.test");
    list[0].render = async () => {
      rendered += 1;
      return { subject: "s", html: "h", text: "t" };
    };
    await deliver({ ...base, dryRun: true, outbound: list, ledger, sender });
    expect(rendered).toBe(0);
  });

  it("stops claiming new recipients once the deadline passes and leaves them untouched (edge #49)", async () => {
    const { ledger, sender } = setup();
    let clock = 1_000_000;
    const now = () => {
      const t = clock;
      clock += 30_000;
      return t;
    };
    const result = await deliver({
      ...base,
      now,
      deadlineMs: 1_000_000 + 50_000,
      outbound: outbound("a@x.test", "b@x.test", "c@x.test", "d@x.test"),
      ledger,
      sender,
    });
    expect(result).toMatchObject({ planned: 4, sent: 2, truncated: true, failed: 0 });
    expect(sender.sent.map((m) => m.to)).toEqual(["a@x.test", "b@x.test"]);
    expect(ledger.all.map((r) => r.email)).toEqual(["a@x.test", "b@x.test"]);
    expect(ledger.calls.claim).toBe(2);
  });

  it("handles an empty list without error", async () => {
    const { ledger, sender } = setup();
    const result = await deliver({ ...base, outbound: [], ledger, sender });
    expect(result).toEqual({ planned: 0, sent: 0, skipped: 0, inFlight: 0, failed: 0, truncated: false, failures: [], warnings: [] });
    expect(sender.sent).toHaveLength(0);
  });
});
