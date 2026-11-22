import { useSyncExternalStore } from "react";

/**
 * Whether the sign-in guide shows. "Don't show again" is remembered in this browser for this person (localStorage);
 * "Hide for now" lasts until this tab or browser session ends (sessionStorage), so it comes back in a new tab or the next day.
 * shortcut: nothing is saved on the server, so a new browser or cleared site data shows the guide again; move it to a profile column if that matters.
 */
const GUIDE_EVENT = "certtracker-guide-change";
const dismissedKey = (userId: string) => `certtracker-guide-dismissed:${userId}`;
const hiddenKey = (userId: string) => `certtracker-guide-hidden:${userId}`;

function has(storage: () => Storage, key: string): boolean {
  try {
    return storage().getItem(key) === "1";
  } catch {
    return false; // storage blocked (private window): show the guide, it is harmless
  }
}

function put(storage: () => Storage, key: string, on: boolean) {
  try {
    if (on) storage().setItem(key, "1");
    else storage().removeItem(key);
  } catch {
    // nothing to remember where storage is blocked
  }
  window.dispatchEvent(new Event(GUIDE_EVENT));
}

export function isGuideVisible(userId: string): boolean {
  return !has(() => localStorage, dismissedKey(userId)) && !has(() => sessionStorage, hiddenKey(userId));
}

export const dismissGuide = (userId: string) => put(() => localStorage, dismissedKey(userId), true);
export const hideGuideForNow = (userId: string) => put(() => sessionStorage, hiddenKey(userId), true);

/** "User guide" in the menu: bring it back even after "Don't show again". */
export function showGuideAgain(userId: string) {
  put(() => localStorage, dismissedKey(userId), false);
  put(() => sessionStorage, hiddenKey(userId), false);
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(GUIDE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(GUIDE_EVENT, onChange);
  };
}

/** False on the server and during hydration, then the stored answer: the page never flashes a guide that was dismissed. */
export function useGuideVisible(userId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isGuideVisible(userId),
    () => false,
  );
}
