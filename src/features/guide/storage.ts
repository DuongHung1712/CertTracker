import { useSyncExternalStore } from "react";
import { dismissedCookie, guideVisibleFrom, hiddenCookie } from "@/features/guide/cookies";

/**
 * Whether the sign-in guide shows. Kept in cookies, not localStorage, so the server can decide before the page renders and the
 * guide never pops in after hydration and shifts the page. "Don't show again" is a cookie that lasts a year; "Hide for now" is a
 * session cookie (gone when the browser closes), so it comes back at the next sign-in.
 * shortcut: nothing is saved on the server, so a new browser or cleared cookies show the guide again; move it to a profile column if that matters.
 */
const GUIDE_EVENT = "certtracker-guide-change";
const ONE_YEAR = 60 * 60 * 24 * 365;

function hasCookie(name: string): boolean {
  try {
    return document.cookie.split("; ").includes(`${name}=1`);
  } catch {
    return false; // cookies blocked: show the guide, it is harmless
  }
}

function setCookie(name: string, on: boolean, maxAge?: number) {
  try {
    document.cookie = on ? `${name}=1; path=/; SameSite=Lax${maxAge ? `; max-age=${maxAge}` : ""}` : `${name}=; path=/; SameSite=Lax; max-age=0`;
  } catch {
    // nothing to remember where cookies are blocked
  }
  window.dispatchEvent(new Event(GUIDE_EVENT));
}

export const isGuideVisible = (userId: string): boolean => guideVisibleFrom(hasCookie, userId);
export const dismissGuide = (userId: string) => setCookie(dismissedCookie(userId), true, ONE_YEAR);
export const hideGuideForNow = (userId: string) => setCookie(hiddenCookie(userId), true);

/** "User guide" in the menu: bring it back even after "Don't show again". */
export function showGuideAgain(userId: string) {
  setCookie(dismissedCookie(userId), false);
  setCookie(hiddenCookie(userId), false);
}

function subscribe(onChange: () => void) {
  window.addEventListener(GUIDE_EVENT, onChange);
  return () => window.removeEventListener(GUIDE_EVENT, onChange);
}

/** `initial` is the server's answer (from the cookies), used for the server render and hydration, then the browser's own. */
export function useGuideVisible(userId: string, initial: boolean): boolean {
  return useSyncExternalStore(subscribe, () => isGuideVisible(userId), () => initial);
}
