/** Cron endpoints authenticate with CRON_SECRET, not a session cookie, so the login proxy must not touch them. */
export const CRON_PATH_PREFIX = "/api/cron/";
export const isCronPath = (pathname: string): boolean => pathname.startsWith(CRON_PATH_PREFIX);
