"use client";

import { Layers, ShieldCheck, TreePine, type LucideIcon } from "lucide-react";
import * as React from "react";

export type ThemeStyle = "classic" | "vault" | "nordic";

export interface StyleOption {
  id: ThemeStyle;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  tagline: string;
  description: string;
}

export const THEME_STYLES: StyleOption[] = [
  {
    id: "classic",
    label: "Classic Swiss",
    shortLabel: "Classic",
    icon: Layers,
    tagline: "Dense, functional, paper & ink",
    description:
      "Original CertTracker design. Crisp flat borders, warm paper-white background, 6px radius, and zero unnecessary decorative ornament.",
  },
  {
    id: "vault",
    label: "Credential Vault",
    shortLabel: "Vault",
    icon: ShieldCheck,
    tagline: "Crisp precision borders & high-contrast surfaces",
    description:
      "Tailored for formal certificates: crisp precision 1px borders, monospace security tags, solid high-contrast surfaces, and live status dots.",
  },
  {
    id: "nordic",
    label: "Nordic Heritage",
    shortLabel: "Nordic",
    icon: TreePine,
    tagline: "Warm linen, pine green & terracotta",
    description:
      "Warm tactile craft: natural linen ground, deep forest pine primary, warm sand borders, and terracotta accents with zero gradients.",
  },
];

const STYLE_IDS: string[] = THEME_STYLES.map((option) => option.id);

export function isThemeStyle(value: unknown): value is ThemeStyle {
  return typeof value === "string" && STYLE_IDS.includes(value);
}

/** The style after `current` in THEME_STYLES order, wrapping round. */
export function nextThemeStyle(current: ThemeStyle): ThemeStyle {
  const index = THEME_STYLES.findIndex((option) => option.id === current);
  return THEME_STYLES[(index + 1) % THEME_STYLES.length].id;
}

export const STYLE_STORAGE_KEY = "certtracker-style";
/** Dispatched on window by setStoredThemeStyle so every reader in this tab re-reads the style. */
export const STYLE_CHANGE_EVENT = "certtracker-style-change";

/** Inline script injected into <head> to prevent FOUC before React hydration */
export const STYLE_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${STYLE_STORAGE_KEY}');if(${JSON.stringify(STYLE_IDS)}.indexOf(s)>=0){document.documentElement.setAttribute('data-style',s);}else{document.documentElement.setAttribute('data-style','classic');}}catch(e){}})();`;

/**
 * Pure helper function to get the current stored theme style from the DOM or localStorage.
 * Safe to call in browser environments outside of React components.
 */
export function getStoredThemeStyle(): ThemeStyle {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-style");
    if (isThemeStyle(attr)) return attr;
  }
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(STYLE_STORAGE_KEY);
      if (isThemeStyle(stored)) return stored;
    } catch {
      // ignore
    }
  }
  return "classic";
}

/**
 * Pure helper function to set the theme style on document.documentElement,
 * persist to localStorage, and dispatch a custom style change event.
 */
export function setStoredThemeStyle(next: ThemeStyle): void {
  if (!isThemeStyle(next)) return;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-style", next);
  }
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STYLE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: next }));
  }
}

/**
 * Pure helper function to move to the next style in THEME_STYLES order.
 */
export function toggleStoredThemeStyle(): ThemeStyle {
  const current = getStoredThemeStyle();
  const next = nextThemeStyle(current);
  setStoredThemeStyle(next);
  return next;
}

export interface StyleContextType {
  style: ThemeStyle;
  setStyle: (style: ThemeStyle) => void;
  toggleStyle: () => void;
  styles: typeof THEME_STYLES;
}

const StyleContext = React.createContext<StyleContextType | undefined>(undefined);

export function StyleProvider({
  children,
  defaultStyle = "classic",
}: {
  children: React.ReactNode;
  defaultStyle?: ThemeStyle;
}) {
  // The style lives on <html data-style> (set before first paint by STYLE_INIT_SCRIPT): an external store, so
  // React reads it instead of copying it into state, and every change below just re-reads it.
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      // Another tab changed or cleared the stored style.
      const onStorage = (e: StorageEvent) => {
        if (e.key !== STYLE_STORAGE_KEY) return;
        const next = isThemeStyle(e.newValue) ? e.newValue : defaultStyle;
        document.documentElement.setAttribute("data-style", next);
        onChange();
      };
      window.addEventListener(STYLE_CHANGE_EVENT, onChange);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(STYLE_CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [defaultStyle],
  );
  const style = React.useSyncExternalStore(subscribe, getStoredThemeStyle, () => defaultStyle);

  // Without the init script (tests, a restricted storage), settle the attribute once: stored, else present, else default.
  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STYLE_STORAGE_KEY);
    } catch {
      // localStorage may fail in restricted/private contexts
    }
    const attr = document.documentElement.getAttribute("data-style");
    const next = isThemeStyle(stored) ? stored : isThemeStyle(attr) ? attr : defaultStyle;
    document.documentElement.setAttribute("data-style", next);
    window.dispatchEvent(new CustomEvent(STYLE_CHANGE_EVENT, { detail: next }));
  }, [defaultStyle]);

  const setStyle = setStoredThemeStyle;
  const toggleStyle = toggleStoredThemeStyle;

  // Global keyboard shortcut: Alt+V to quickly toggle visual style
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "v" || e.key === "V")) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleStyle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleStyle]);

  const value = React.useMemo(
    () => ({
      style,
      setStyle,
      toggleStyle,
      styles: THEME_STYLES,
    }),
    [style, setStyle, toggleStyle],
  );

  return <StyleContext.Provider value={value}>{children}</StyleContext.Provider>;
}

export function useThemeStyle() {
  const context = React.useContext(StyleContext);
  if (!context) {
    throw new Error("useThemeStyle must be used within a StyleProvider");
  }
  return context;
}
