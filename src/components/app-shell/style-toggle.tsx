"use client";

import * as React from "react";
import { Layers, ShieldCheck } from "lucide-react";
import {
  useThemeStyleOptional,
  getStoredThemeStyle,
  toggleStoredThemeStyle,
  STYLE_STORAGE_KEY,
  type ThemeStyle,
} from "@/components/style-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StyleToggle({ className }: { className?: string }) {
  const context = useThemeStyleOptional();
  const [fallbackStyle, setFallbackStyle] = React.useState<ThemeStyle>(() => getStoredThemeStyle());

  // In fallback mode (outside StyleProvider), keep fallbackStyle reactive to events
  React.useEffect(() => {
    if (context) return;
    const handleStyleChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeStyle>;
      if (customEvent.detail === "classic" || customEvent.detail === "vault") {
        setFallbackStyle(customEvent.detail);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STYLE_STORAGE_KEY && (e.newValue === "classic" || e.newValue === "vault")) {
        setFallbackStyle(e.newValue);
      }
    };
    window.addEventListener("certtracker-style-change", handleStyleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("certtracker-style-change", handleStyleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [context]);

  const style = context ? context.style : fallbackStyle;
  const isVault = style === "vault";

  const toggleStyle = () => {
    if (context) {
      context.toggleStyle();
    } else {
      const next = toggleStoredThemeStyle();
      setFallbackStyle(next);
    }
  };

  const targetLabel = isVault ? "Classic Swiss" : "Credential Vault";
  const currentLabel = isVault ? "Credential Vault" : "Classic Swiss";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleStyle}
            aria-label={`Switch visual style to ${targetLabel} (currently ${currentLabel}). Shortcut: Alt+V`}
            className={className}
          >
            {isVault ? (
              <ShieldCheck aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Layers aria-hidden className="size-4" />
            )}
            <span className="hidden lg:inline text-xs font-medium">
              {isVault ? "Vault" : "Classic"}
            </span>
          </Button>
        }
      />
      <TooltipContent side="bottom">
        <p className="text-xs">
          Visual Style: <span className="font-semibold">{currentLabel}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">Click or press Alt+V to switch to {targetLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}
