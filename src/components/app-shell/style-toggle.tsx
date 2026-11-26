"use client";

import { nextThemeStyle, THEME_STYLES, useThemeStyle, type ThemeStyle } from "@/components/style-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_TONE: Partial<Record<ThemeStyle, string>> = { vault: "text-primary", nordic: "text-primary" };
const optionOf = (style: ThemeStyle) => THEME_STYLES.find((option) => option.id === style) ?? THEME_STYLES[0];

/** One-click switch cycling between visual styles (Classic -> Vault -> Nordic -> Classic). */
export function StyleToggle({ className }: { className?: string }) {
  const { style, toggleStyle } = useThemeStyle();
  const meta = optionOf(style);
  const next = optionOf(nextThemeStyle(meta.id));
  const Icon = meta.icon;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleStyle}
            className={className}
          >
            <Icon aria-hidden className={cn("size-4", ICON_TONE[meta.id])} />
            <span className="hidden text-caption font-medium lg:inline">{meta.shortLabel}</span>{" "}
            <span className="sr-only">
              Switch visual style to {next.label} (currently {meta.label}). Shortcut: Alt+V
            </span>
          </Button>
        }
      />
      <TooltipContent side="bottom">
        <p className="text-caption">
          Visual style: <span className="font-semibold">{meta.label}</span>
        </p>
        <p className="text-caption text-muted-foreground">Click or press Alt+V to switch to {next.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
