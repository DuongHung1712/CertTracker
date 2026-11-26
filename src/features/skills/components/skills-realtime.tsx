"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-runs the server queries for `/skills` when `member_skills` or `training_records` change.
 * The payload itself is never trusted; the server always reloads under caller RLS.
 */
export function SkillsRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const refresh = () => {
      if (cancelled) return;
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    async function subscribe() {
      try {
        await supabase.realtime.setAuth();
      } catch {
        // No session: the channel below simply receives nothing.
      }
      if (cancelled) return;
      channel = supabase
        .channel(`skills-workspace-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "member_skills" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "training_records" }, refresh)
        .subscribe();
    }
    void subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
