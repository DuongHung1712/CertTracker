const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * The base URL used for links in e-mails, or `null` when it must not be used. Only `https:` is accepted
 * (`http:` for localhost, so local development works); anything else, including `javascript:` and values
 * without a scheme, yields `null` and the mails go out without links. Credentials, query and fragment are dropped,
 * trailing slashes are stripped.
 */
export function normalizeAppUrl(raw: string | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const allowed = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!allowed) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
