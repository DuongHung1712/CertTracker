"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hasSpotlight?: boolean;
  hasHologram?: boolean;
  hasBorderBeam?: boolean;
  isVerified?: boolean;
}

export function SpotlightCard({
  children,
  className,
  hasSpotlight = true,
  hasHologram = false,
  hasBorderBeam = false,
  isVerified = false,
  ...props
}: SpotlightCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!hasSpotlight || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cardRef.current.style.setProperty("--mouse-x", `${x}px`);
      cardRef.current.style.setProperty("--mouse-y", `${y}px`);
    },
    [hasSpotlight],
  );

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      data-verified={isVerified ? "true" : undefined}
      className={cn(
        "relative rounded-xl border border-border bg-card p-5 transition-all",
        hasSpotlight && "vault-spotlight",
        hasHologram && "vault-hologram",
        isVerified && "vault-verified",
        className,
      )}
      {...props}
    >
      {hasBorderBeam && <div className="vault-border-beam" aria-hidden />}
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}
