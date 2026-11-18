"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface VaultCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Whether this card represents a cryptographically verified security credential. */
  isVerified?: boolean;
}

/**
 * VaultCard: Museum-grade, anti-slop security credential container.
 * Features crisp 1px solid precision borders, solid high-contrast surfaces,
 * and zero AI-slop gimmicks (no gradient spotlights, no laser beams, no holograms).
 */
export function VaultCard({
  children,
  className,
  isVerified = false,
  ...props
}: VaultCardProps) {
  return (
    <div
      data-slot="vault-card"
      data-verified={isVerified ? "true" : undefined}
      className={cn(
        "relative rounded-xl border border-border bg-card p-5 transition-colors",
        "vault-card",
        isVerified && "vault-verified",
        className,
      )}
      {...props}
    >
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

/** Backwards-compatibility alias for previous imports */
export const SpotlightCard = VaultCard;
export type SpotlightCardProps = VaultCardProps;
