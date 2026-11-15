const MAX_LENGTH = 512;
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;
// Pages a signed-in user is bounced away from (or that sign the user out), plus routes that are not pages.
const BLOCKED = ["/login", "/set-password", "/api", "/_next"];

const isUnsafe = (value: string) => CONTROL.test(value) || value.includes("\\") || value.startsWith("//");

/**
 * Returns `raw` as a same-app path ("/records?search=AWS") when it is safe to redirect to after sign-in, else null.
 * Rejects anything that could leave the app (scheme, host, "//", backslash), control characters, auth pages and
 * over-long input. The value is checked both as given and once decoded, because "/%2F%2Fevil.com" is not an open
 * redirect today but must not become one if something decodes it later.
 */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith("/") || isUnsafe(raw)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (isUnsafe(decoded)) return null;

  const base = "http://app.invalid";
  const url = new URL(raw, base);
  if (url.origin !== base) return null;
  // Compared after the URL parser resolved "/records/../login" and percent-encoded letters.
  const path = decodeURIComponent(url.pathname).toLowerCase();
  if (BLOCKED.some((blocked) => path === blocked || path.startsWith(`${blocked}/`))) return null;

  // The parser resolves dot segments, so "/.//evil.com" becomes "//evil.com": re-check what is actually returned.
  const out = url.pathname + url.search;
  if (!out.startsWith("/") || isUnsafe(out)) return null;
  try {
    if (isUnsafe(decodeURIComponent(out))) return null;
  } catch {
    return null;
  }
  return out;
}
