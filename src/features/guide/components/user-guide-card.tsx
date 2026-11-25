"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role } from "@/components/status/labels";
import { Button } from "@/components/ui/button";
import { GUIDE } from "@/features/guide/content";
import { dismissGuide, hideGuideForNow, showGuideAgain, useGuideVisible } from "@/features/guide/storage";

/**
 * A one-line guide under the dashboard header after sign-in; "Show steps" opens the steps. It does not block the page:
 * "Hide for now" hides it for this visit, "Don't show again" for good. `forceOpen` (the menu's "User guide") brings it back
 * with the steps open. `initialVisible` is the server's answer from the cookies, so the card is in the first paint or not at all.
 */
export type UserGuideProps = { userId: string; role: Role; forceOpen?: boolean; initialVisible?: boolean };

export function UserGuideCard({ userId, role, forceOpen = false, initialVisible = true }: UserGuideProps) {
  const router = useRouter();
  // `forced` keeps the card up from the first paint of /dashboard?guide=1 until the cookies are cleared, so it never flickers off and on.
  const [prevForceOpen, setPrevForceOpen] = useState(forceOpen);
  const [forced, setForced] = useState(forceOpen);
  const visible = useGuideVisible(userId, initialVisible || forceOpen) || forced;
  const [stepsOpen, setStepsOpen] = useState(forceOpen);
  if (forceOpen !== prevForceOpen) {
    setPrevForceOpen(forceOpen);
    if (forceOpen) {
      setForced(true);
      setStepsOpen(true);
    }
  }
  useEffect(() => {
    if (!forceOpen) return;
    showGuideAgain(userId);
    // Take `?guide=1` off the address: a refresh must not bring the guide back after "Don't show again", and the menu item works again.
    router.replace("/dashboard", { scroll: false });
  }, [forceOpen, userId, router]);

  if (!visible) return null;
  const guide = GUIDE[role];
  return (
    <section aria-label={guide.title} className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 text-body text-muted-foreground">
          <span className="font-medium text-foreground">{guide.title}.</span> {guide.intro}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" aria-expanded={stepsOpen} onClick={() => setStepsOpen((open) => !open)}>
            {stepsOpen ? "Hide steps" : "Show steps"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => {
              setForced(false);
              hideGuideForNow(userId);
            }}>
            Hide for now
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => {
              setForced(false);
              dismissGuide(userId);
            }}>
            Don&apos;t show again
          </Button>
        </div>
      </div>
      {stepsOpen && (
        <ul className="grid gap-x-6 gap-y-3 border-t border-border pt-3 sm:grid-cols-2">
          {guide.steps.map((step) => (
            <li key={step.title} className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-foreground">{step.title}</span>
              <span className="text-caption text-muted-foreground">{step.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
