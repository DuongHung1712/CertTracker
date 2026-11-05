import { describe, expect, it } from "vitest";
import { normalizeAppUrl } from "@/features/notifications/app-url";

describe("normalizeAppUrl", () => {
  it("accepts https and strips trailing slashes", () => {
    expect(normalizeAppUrl("https://app.example.com")).toBe("https://app.example.com");
    expect(normalizeAppUrl("https://app.example.com///")).toBe("https://app.example.com");
    expect(normalizeAppUrl("  https://app.example.com/base/ ")).toBe("https://app.example.com/base");
  });

  it("accepts http only for localhost", () => {
    expect(normalizeAppUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(normalizeAppUrl("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100");
    expect(normalizeAppUrl("http://app.example.com")).toBeNull();
  });

  it("rejects other schemes, a missing scheme and garbage", () => {
    expect(normalizeAppUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeAppUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeAppUrl("app.example.com")).toBeNull();
    expect(normalizeAppUrl("//app.example.com")).toBeNull();
    expect(normalizeAppUrl("not a url")).toBeNull();
    expect(normalizeAppUrl("")).toBeNull();
    expect(normalizeAppUrl(undefined)).toBeNull();
  });

  it("drops credentials, query and fragment", () => {
    expect(normalizeAppUrl("https://user:pw@app.example.com/?a=1#x")).toBe("https://app.example.com");
  });
});
