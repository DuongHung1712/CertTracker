import { describe, expect, it } from "vitest";
import { assertLocalSupabaseUrl } from "@/lib/assert-local-supabase-url";

describe("assertLocalSupabaseUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321", "http://localhost", "https://localhost:54321/"])(
    "accepts %s",
    (url) => {
      expect(() => assertLocalSupabaseUrl(url)).not.toThrow();
    },
  );

  it.each([
    "https://abcd.supabase.co",
    "http://127.0.0.1.evil.com",
    "http://localhost.evil.com",
    "http://evil.com/127.0.0.1",
    "http://localhost@evil.com",
    "http://127.0.0.1@evil.com:54321",
    "http://evil.com#localhost",
    "http://localhost.:54321",
    "ftp://localhost",
    "",
    "not a url",
    "localhost:54321",
  ])("rejects %j", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).toThrow(/Refusing/);
  });

  it("names the offending host", () => {
    expect(() => assertLocalSupabaseUrl("https://abcd.supabase.co")).toThrow("abcd.supabase.co");
  });
});
