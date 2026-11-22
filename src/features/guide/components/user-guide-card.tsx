"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Role } from "@/components/status/labels";
import { Button } from "@/components/ui/button";
import { GUIDE } from "@/features/guide/content";
import { dismissGuide, hideGuideForNow, showGuideAgain, useGuideVisible } from "@/features/guide/storage";

/**
 * A short guide at the top of the dashboard after sign-in. It does not block the page: "Hide for now" hides it for this
 * visit, "Don't show again" for good. `forceOpen` (the menu's "User guide") brings it back.
 */
export function UserGuideCard({ userId, role, forceOpen = false }: { userId: string; role: Role; forceOpen?: boolean }) {
  const router = useRouter();
  const visible = useGuideVisible(userId);
  useEffect(() => {
    if (!forceOpen) return;
    showGuideAgain(userId);
    // Take `?guide=1` off the address: a refresh must not bring the guide back after "Don't show again", and the menu item works again.
    router.replace("/dashboard", { scroll: false });
  }, [forceOpen, userId, router]);

  if (!visible) return null;
  const guide = GUIDE[role];
  return (
    <section aria-labelledby="user-guide-title" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 id="user-guide-title" className="text-section-title font-semibold text-foreground">
          {guide.title}
        </h2>
        <p className="text-body text-muted-foreground">{guide.intro}</p>
      </div>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {guide.steps.map((step) => (
          <li key={step.title} className="flex flex-col gap-0.5">
            <span className="text-body font-medium text-foreground">{step.title}</span>
            <span className="text-caption text-muted-foreground">{step.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => hideGuideForNow(userId)}>
          Hide for now
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => dismissGuide(userId)}>
          Don&apos;t show again
        </Button>
      </div>
    </section>
  );
}
