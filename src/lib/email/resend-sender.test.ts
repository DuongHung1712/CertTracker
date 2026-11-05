import { describe, expect, it, vi } from "vitest";
import { ResendSender } from "@/lib/email/resend-sender";
import type { EmailMessage } from "@/lib/email/sender";

const message: EmailMessage = { to: "a@b.co", subject: "Hello", html: "<p>x</p>", text: "x", idempotencyKey: "key-1" };

type SendFn = (
  payload: { from: string; to: string[]; subject: string; html: string; text: string },
  options?: { idempotencyKey?: string },
) => Promise<{ data: { id: string } | null; error: { name: string; message: string } | null }>;

function setup(send: SendFn, minIntervalMs = 0) {
  const clock = { t: 1_000 };
  const fn = vi.fn(send);
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  const sender = new ResendSender({
    apiKey: "re_x",
    from: "CertTracker <no-reply@x.co>",
    minIntervalMs,
    client: { emails: { send: fn } },
    now: () => clock.t,
    sleep,
  });
  return { sender, fn, sleep, clock };
}

const ok: SendFn = async () => ({ data: { id: "id-1" }, error: null });

describe("ResendSender", () => {
  it("maps a success and passes the payload and idempotency key", async () => {
    const { sender, fn } = setup(ok);
    expect(await sender.send(message)).toEqual({ ok: true, providerId: "id-1" });
    expect(fn).toHaveBeenCalledWith(
      { from: "CertTracker <no-reply@x.co>", to: ["a@b.co"], subject: "Hello", html: "<p>x</p>", text: "x" },
      { idempotencyKey: "key-1" },
    );
  });

  it("maps an error object to a failure value", async () => {
    const { sender } = setup(async () => ({ data: null, error: { name: "validation_error", message: "bad" } }));
    expect(await sender.send(message)).toEqual({ ok: false, error: "validation_error: bad" });
  });

  it("never throws: a thrown exception becomes a failure value (edge #51)", async () => {
    const { sender } = setup(async () => {
      throw new Error("socket hang up");
    });
    expect(await sender.send(message)).toEqual({ ok: false, error: "socket hang up" });
  });

  it("stringifies a non-Error throw", async () => {
    const { sender } = setup(async () => {
      throw "boom";
    });
    expect(await sender.send(message)).toEqual({ ok: false, error: "boom" });
  });

  it("strips CR/LF from the subject (edge #52)", async () => {
    const { sender, fn } = setup(ok);
    await sender.send({ ...message, subject: "a\r\nBcc: x" });
    expect(fn.mock.calls[0]?.[0].subject).toBe("a Bcc: x");
  });

  it("sleeps when called again before minIntervalMs has passed", async () => {
    const { sender, sleep } = setup(ok, 600);
    await sender.send(message);
    expect(sleep).not.toHaveBeenCalled(); // the first send never waits
    await sender.send(message);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(600);
  });

  it("sleeps only for the time still missing", async () => {
    const { sender, sleep, clock } = setup(ok, 600);
    await sender.send(message);
    clock.t += 250;
    await sender.send(message);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(350);
  });

  it("does not sleep when enough time has passed", async () => {
    const { sender, sleep, clock } = setup(ok, 600);
    await sender.send(message);
    clock.t += 700;
    await sender.send(message);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("never sleeps with minIntervalMs 0", async () => {
    const { sender, sleep } = setup(ok, 0);
    await sender.send(message);
    await sender.send(message);
    expect(sleep).not.toHaveBeenCalled();
  });
});
