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
    ledger.markSentThrowsFor.add("a@x.test");
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
    expect(result).toEqual({ planned: 0, sent: 0, skipped: 0, failed: 0, truncated: false, failures: [], warnings: [] });
    expect(sender.sent).toHaveLength(0);
  });
});
