import { describe, expect, it } from "vitest";
import { isCronPath } from "@/lib/cron-path";

describe("isCronPath", () => {
  it("matches only paths under /api/cron/", () => {
    expect(isCronPath("/api/cron/expiry-alerts")).toBe(true);
    expect(isCronPath("/api/cron/monthly-report")).toBe(true);
    expect(isCronPath("/api/cron")).toBe(false);
    expect(isCronPath("/api/cronjobs/x")).toBe(false);
    expect(isCronPath("/api/records/1")).toBe(false);
    expect(isCronPath("/dashboard")).toBe(false);
  });
});
