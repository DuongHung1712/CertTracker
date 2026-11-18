"use client";

import * as React from "react";
import { Layers, ShieldCheck } from "lucide-react";
import { useThemeStyle } from "@/components/style-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StyleToggle({ className }: { className?: string }) {
  const { style, toggleStyle } = useThemeStyle();
  const isVault = style === "vault";

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
