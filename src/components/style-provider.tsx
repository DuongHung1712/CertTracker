"use client";

import * as React from "react";

export type ThemeStyle = "classic" | "aurora" | "tactile" | "vault";

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
      "Original CertTracker design. Crisp borders, warm paper-white background, and zero unnecessary decorative blur.",
  },
  {
    id: "aurora",
    label: "Aurora Glass",
    tagline: "Frosted glassmorphism & ambient glow",
    description:
      "Translucent glass panels with ambient backdrop blur, iridescent glows, and solid sticky table cells for crisp data reading.",
  },
  {
    id: "tactile",
    label: "Modern Tactile 2.0",
    tagline: "Layered elevation & physical feel",
    description:
      "Subtle dual shadows, concave inner-shadow input fields, and realistic tactile push-down button feedback.",
  },
  {
    id: "vault",
    label: "Credential Vault",
    tagline: "Cryptographic security & physical seal",
    description:
      "Tailored for authentic credentials: interactive spotlight cards, holographic security sheen, animated border beam pulses, and live glowing status indicators.",
  },
];

export const STYLE_STORAGE_KEY = "certtracker-style";

export const STYLE_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${STYLE_STORAGE_KEY}');if(s==='aurora'||s==='tactile'||s==='vault'||s==='classic'){document.documentElement.setAttribute('data-style',s);}else{document.documentElement.setAttribute('data-style','classic');}}catch(e){}})();`;

interface StyleContextType {
  style: ThemeStyle;
  setStyle: (style: ThemeStyle) => void;
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
      if (stored === "classic" || stored === "aurora" || stored === "tactile" || stored === "vault") {
        setStyleState(stored);
        document.documentElement.setAttribute("data-style", stored);
      } else {
        const currentAttr = document.documentElement.getAttribute("data-style") as ThemeStyle | null;
        if (currentAttr === "classic" || currentAttr === "aurora" || currentAttr === "tactile" || currentAttr === "vault") {
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
    if (next !== "classic" && next !== "aurora" && next !== "tactile" && next !== "vault") return;
    setStyleState(next);
    try {
      localStorage.setItem(STYLE_STORAGE_KEY, next);
      document.documentElement.setAttribute("data-style", next);
      window.dispatchEvent(new CustomEvent("certtracker-style-change", { detail: next }));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STYLE_STORAGE_KEY) {
        if (e.newValue) {
          const next = e.newValue as ThemeStyle;
          if (next === "classic" || next === "aurora" || next === "tactile" || next === "vault") {
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

  // Global mouse-tracking spotlight coordinator for the Vault style
  React.useEffect(() => {
    if (style !== "vault") return;

    const handlePointerMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        ".vault-spotlight, [data-spotlight], .vault-card, [data-slot='card'], dl > div",
      );
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [style]);

  const value = React.useMemo(
    () => ({
      style,
      setStyle,
      styles: THEME_STYLES,
    }),
    [style, setStyle],
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
