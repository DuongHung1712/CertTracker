/** Hostnames the destructive e2e helpers may talk to (`URL.hostname` keeps the brackets of an IPv6 literal). */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Throws unless `url` points at a local Supabase. The e2e restore helper deletes data, and its URL comes from the
 * same `.env.local` the dev app reads, so a hosted project must never get past this check.
 * The hostname is compared exactly: lookalikes (`localhost.evil.com`) and userinfo tricks (`localhost@evil.com`) fail.
 */
export function assertLocalSupabaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Refusing to run against a Supabase URL that cannot be parsed: ${JSON.stringify(url)}.`);
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(
      `Refusing to run against non-local Supabase host "${parsed.hostname}"; only localhost, 127.0.0.1 and [::1] are allowed.`,
    );
  }
}
