"use client";

import * as React from "react";

export type ThemeStyle = "classic" | "vault";

export interface StyleOption {
  id: ThemeStyle;
  label: string;
  tagline: string;
  description: string;
}

export const THEME_STYLES: StyleOption[] = [
  {
    id: "classic",
    label: "Classic Swiss",
    tagline: "Dense, functional, paper & ink",
    description:
      "Original CertTracker design. Crisp flat borders, warm paper-white background, 6px radius, and zero unnecessary decorative ornament.",
  },
  {
    id: "vault",
    label: "Credential Vault",
    tagline: "Cryptographic security & physical credential",
    description:
      "Tailored for authentic credentials: crisp precision 1px borders, monospace security tags, solid high-contrast surfaces, and live status dots.",
  },
];

export const STYLE_STORAGE_KEY = "certtracker-style";

/** Inline script injected into <head> to prevent FOUC before React hydration */
export const STYLE_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${STYLE_STORAGE_KEY}');if(s==='vault'||s==='classic'){document.documentElement.setAttribute('data-style',s);}else{document.documentElement.setAttribute('data-style','classic');}}catch(e){}})();`;

/**
 * Pure helper function to get the current stored theme style from the DOM or localStorage.
 * Safe to call in browser environments outside of React components.
 */
export function getStoredThemeStyle(): ThemeStyle {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-style");
    if (attr === "classic" || attr === "vault") return attr;
  }
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(STYLE_STORAGE_KEY);
      if (stored === "classic" || stored === "vault") return stored;
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
  if (next !== "classic" && next !== "vault") return;
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
    window.dispatchEvent(new CustomEvent("certtracker-style-change", { detail: next }));
  }
}

/**
 * Pure helper function to toggle between 'classic' and 'vault' styles.
 */
export function toggleStoredThemeStyle(): ThemeStyle {
  const current = getStoredThemeStyle();
  const next: ThemeStyle = current === "classic" ? "vault" : "classic";
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
  const [style, setStyleState] = React.useState<ThemeStyle>(defaultStyle);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STYLE_STORAGE_KEY) as ThemeStyle | null;
      if (stored === "classic" || stored === "vault") {
        setStyleState(stored);
        document.documentElement.setAttribute("data-style", stored);
      } else {
        const currentAttr = document.documentElement.getAttribute("data-style") as ThemeStyle | null;
        if (currentAttr === "classic" || currentAttr === "vault") {
          setStyleState(currentAttr);
        } else {
          document.documentElement.setAttribute("data-style", defaultStyle);
        }
      }
    } catch {
      // localStorage may fail in restricted/private contexts
    }
  }, [defaultStyle]);

  const setStyle = React.useCallback((next: ThemeStyle) => {
    if (next !== "classic" && next !== "vault") return;
    setStyleState(next);
    setStoredThemeStyle(next);
  }, []);

  const toggleStyle = React.useCallback(() => {
    setStyleState((prev) => {
      const next = prev === "classic" ? "vault" : "classic";
      setStoredThemeStyle(next);
      return next;
    });
  }, []);

  // Multi-tab synchronization
  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STYLE_STORAGE_KEY) {
        if (e.newValue) {
          const next = e.newValue as ThemeStyle;
          if (next === "classic" || next === "vault") {
            setStyleState(next);
            document.documentElement.setAttribute("data-style", next);
          }
        } else {
          // localStorage key was removed or cleared
          setStyleState(defaultStyle);
          document.documentElement.setAttribute("data-style", defaultStyle);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultStyle]);

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

export function useThemeStyleOptional() {
  return React.useContext(StyleContext);
}

export function useThemeStyle() {
  const context = React.useContext(StyleContext);
  if (!context) {
    throw new Error("useThemeStyle must be used within a StyleProvider");
  }
  return context;
}
