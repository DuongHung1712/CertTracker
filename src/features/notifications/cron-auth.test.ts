import { describe, expect, it } from "vitest";
import { checkCronAuth } from "@/features/notifications/cron-auth";

const SECRET = "0123456789abcdef-secret";

describe("checkCronAuth", () => {
  it("accepts the exact bearer token", () => {
    expect(checkCronAuth(`Bearer ${SECRET}`, SECRET)).toBe("ok");
  });
  it.each([null, "", "Bearer ", `Bearer wrong-token-0123456789`, `bearer ${SECRET}`, `Basic ${SECRET}`, SECRET])(
    "rejects %j",
    (header) => {
      expect(checkCronAuth(header, SECRET)).toBe("unauthorized");
    },
  );
  it("rejects a token that only shares a prefix with the secret", () => {
    expect(checkCronAuth(`Bearer ${SECRET}x`, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe("unauthorized");
  });
  it("fails closed when the secret is missing, empty or too short (edge #54)", () => {
    expect(checkCronAuth(`Bearer ${SECRET}`, undefined)).toBe("misconfigured");
    expect(checkCronAuth(`Bearer ${SECRET}`, "")).toBe("misconfigured");
    expect(checkCronAuth("Bearer short", "short")).toBe("misconfigured");
  });
  it("never lets an empty bearer match an empty secret", () => {
    expect(checkCronAuth("Bearer ", "")).toBe("misconfigured");
  });
});
