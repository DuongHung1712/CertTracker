"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-runs the page's server queries when any training record changes. It only signals "something
 * changed"; the data itself is always re-read on the server under RLS, so nothing in the event
 * payload is trusted or displayed. (DELETE events are not RLS-filtered by Realtime and carry only
 * the primary key — harmless here for the same reason.)
 */
export function RecordsRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    // A bulk change (the Excel import commits hundreds of rows) arrives as a burst: coalesce it.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    async function subscribe() {
      // The browser client reads its session from cookies asynchronously. A channel joined before
      // the user's JWT reaches the socket is joined as anon, RLS then hides every row from it and
      // no event ever arrives (the channel still reports SUBSCRIBED). So load the token first.
      try {
        await supabase.realtime.setAuth();
      } catch {
        // No session: the channel below simply receives nothing.
      }
      if (cancelled) return;
      channel = supabase
        .channel("training-records-list")
        .on("postgres_changes", { event: "*", schema: "public", table: "training_records" }, refresh)
        .subscribe();
    }
    void subscribe();

    // A backgrounded tab may have missed events while its socket slept.
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
