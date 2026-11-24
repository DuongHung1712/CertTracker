// Server-safe: the page reads these names from the request's cookies, the browser code in storage.ts writes them.
export const dismissedCookie = (userId: string) => `ct-guide-dismissed-${userId}`;
export const hiddenCookie = (userId: string) => `ct-guide-hidden-${userId}`;

/** The same rule for the server (cookie store) and the browser (`document.cookie`). */
export function guideVisibleFrom(has: (name: string) => boolean, userId: string): boolean {
  return !has(dismissedCookie(userId)) && !has(hiddenCookie(userId));
}
